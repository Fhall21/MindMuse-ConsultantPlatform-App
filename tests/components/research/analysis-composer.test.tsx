// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AnalysisComposer } from "@/components/research/analysis-composer";

const mockPush = vi.fn();
const mockEnhanceMutate = vi.fn();
const mockCreateMutate = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/hooks/use-ai-preferences", () => ({
  useAIPreferences: () => ({ data: { industry: "Healthcare" } }),
}));

vi.mock("@/hooks/use-research", () => ({
  useEnhanceQuestion: () => ({
    mutateAsync: mockEnhanceMutate,
    isPending: false,
  }),
  useCreateAnalysisSession: () => ({
    mutateAsync: mockCreateMutate,
    isPending: false,
  }),
}));

vi.mock("@/lib/research/csv-headers", () => ({
  extractHeaders: vi.fn(async () => ["employee_id", "department"]),
}));

function makeCsvFile(name = "data.csv") {
  return new File(["employee_id,department\n1,HR\n"], name, { type: "text/csv" });
}

describe("AnalysisComposer enhancement flow", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockEnhanceMutate.mockReset();
    mockCreateMutate.mockReset();
    mockCreateMutate.mockResolvedValue({ id: "sess-new", fileEntryId: "file-1" });
  });

  it("skips clarification and creates session when enhancement is clear", async () => {
    mockEnhanceMutate.mockResolvedValue({
      needs_clarification: false,
      enhanced_query: "Refined HR psychosocial analysis",
      rationale: "Clear enough",
      background: "",
      suggested_models: [],
      questions: [],
    });

    render(<AnalysisComposer />);

    fireEvent.change(screen.getByPlaceholderText(/Surface the most pressing/), {
      target: { value: "What are the main themes?" },
    });

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeCsvFile()] } });

    fireEvent.click(screen.getByRole("button", { name: /Run analysis/i }));

    await waitFor(() => {
      expect(mockEnhanceMutate).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockCreateMutate).toHaveBeenCalledWith(
        expect.objectContaining({ query: "Refined HR psychosocial analysis" })
      );
      expect(mockPush).toHaveBeenCalledWith("/research/sess-new");
    });
  });

  it("shows MCQ form when clarification is needed", async () => {
    mockEnhanceMutate.mockResolvedValue({
      needs_clarification: true,
      background: "Jurisdiction affects hazard frameworks.",
      suggested_models: ["chi-square"],
      questions: [
        {
          id: "jurisdiction",
          question: "Which jurisdiction applies?",
          rationale: "Hazard lists differ by state.",
          allow_multiple: false,
          options: [
            { id: "nsw", label: "NSW" },
            { id: "vic", label: "Victoria" },
          ],
        },
      ],
    });

    render(<AnalysisComposer />);

    fireEvent.change(screen.getByPlaceholderText(/Surface the most pressing/), {
      target: { value: "Psychosocial hazards in HR data" },
    });

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeCsvFile()] } });

    fireEvent.click(screen.getByRole("button", { name: /Run analysis/i }));

    await waitFor(() => {
      expect(screen.getByText(/Which jurisdiction applies/i)).toBeInTheDocument();
    });

    expect(mockCreateMutate).not.toHaveBeenCalled();
  });

  it("submits prior answers and creates session with enhanced query", async () => {
    mockEnhanceMutate
      .mockResolvedValueOnce({
        needs_clarification: true,
        background: "Context",
        suggested_models: [],
        questions: [
          {
            id: "jurisdiction",
            question: "Which jurisdiction applies?",
            rationale: "Needed",
            allow_multiple: false,
            options: [
              { id: "nsw", label: "NSW" },
              { id: "vic", label: "Victoria" },
            ],
          },
        ],
      })
      .mockResolvedValueOnce({
        needs_clarification: false,
        enhanced_query: "NSW psychosocial hazard analysis",
        rationale: "Incorporated jurisdiction",
        background: "",
        suggested_models: [],
        questions: [],
      });

    render(<AnalysisComposer />);

    fireEvent.change(screen.getByPlaceholderText(/Surface the most pressing/), {
      target: { value: "Psychosocial hazards" },
    });

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeCsvFile()] } });

    fireEvent.click(screen.getByRole("button", { name: /Run analysis/i }));

    await waitFor(() => {
      expect(screen.getByText(/Which jurisdiction applies/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("radio", { name: "NSW" }));
    fireEvent.click(screen.getByRole("button", { name: /Refine and run/i }));

    await waitFor(() => {
      expect(mockEnhanceMutate).toHaveBeenCalledTimes(2);
      expect(mockCreateMutate).toHaveBeenCalledWith(
        expect.objectContaining({ query: "NSW psychosocial hazard analysis" })
      );
    });
  });

  it("skip path uses original question without second enhance call", async () => {
    mockEnhanceMutate.mockResolvedValue({
      needs_clarification: true,
      background: "Context",
      suggested_models: [],
      questions: [
        {
          id: "jurisdiction",
          question: "Which jurisdiction applies?",
          rationale: "Needed",
          allow_multiple: false,
          options: [{ id: "nsw", label: "NSW" }],
        },
      ],
    });

    render(<AnalysisComposer />);

    fireEvent.change(screen.getByPlaceholderText(/Surface the most pressing/), {
      target: { value: "Original question text" },
    });

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeCsvFile()] } });

    fireEvent.click(screen.getByRole("button", { name: /Run analysis/i }));

    await waitFor(() => {
      expect(screen.getByText(/Skip and use my question as-is/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Skip and use my question as-is/i }));

    await waitFor(() => {
      expect(mockEnhanceMutate).toHaveBeenCalledTimes(1);
      expect(mockCreateMutate).toHaveBeenCalledWith(
        expect.objectContaining({ query: "Original question text" })
      );
    });
  });
});
