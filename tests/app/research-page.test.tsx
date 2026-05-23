// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ResearchPage from "@/app/(app)/research/page";
import type { ResearchSessionSummary } from "@/hooks/use-research";

vi.mock("@/hooks/use-ai-preferences", () => ({
  useAIPreferences: () => ({ data: null }),
}));

const researchHooksMock = vi.hoisted(() => ({
  useResearchSessions: vi.fn(() => ({ data: [] as ResearchSessionSummary[], isLoading: false, error: null })),
  useCreateResearchSession: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useLiteratureResearch: vi.fn(() => ({
    status: "idle" as const,
    result: null,
    error: null,
    elapsedSeconds: 0,
    reasoningSteps: [],
    sessionId: null,
    submit: vi.fn(),
    reset: vi.fn(),
  })),
  useDataAnalysis: vi.fn(() => ({
    status: "idle" as const,
    result: null,
    error: null,
    elapsedSeconds: 0,
    pollingMessage: "",
    notebookCells: [],
    sessionId: null,
    fileEntryId: null,
    submit: vi.fn(),
    reset: vi.fn(),
    cancel: vi.fn(),
    reconnectSession: vi.fn(),
    isCancellable: false,
  })),
}));

vi.mock("@/hooks/use-research", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/use-research")>();
  return {
    ...actual,
    useLiteratureResearch: researchHooksMock.useLiteratureResearch,
    useDataAnalysis: researchHooksMock.useDataAnalysis,
    useResearchSessions: researchHooksMock.useResearchSessions,
    useCreateResearchSession: researchHooksMock.useCreateResearchSession,
  };
});

// Stub next/navigation so router.push doesn't throw in jsdom
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("ResearchPage", () => {
  it("renders Literature and Data Analysis tabs", () => {
    render(<ResearchPage />);

    expect(screen.getByRole("heading", { name: "Research" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/What does the literature say about/)).toBeInTheDocument();
  });

  it("switches to Data Analysis tab", () => {
    render(<ResearchPage />);

    fireEvent.click(screen.getByRole("tab", { name: "Data Analysis" }));

    expect(screen.getByText(/Click to choose CSV files/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Run analysis/i })).toBeInTheDocument();
  });

  it("renders Search literature submit button", () => {
    render(<ResearchPage />);

    expect(screen.getByRole("button", { name: /Search literature/i })).toBeInTheDocument();
  });

  it("renders empty state when no previous sessions", () => {
    render(<ResearchPage />);

    expect(screen.getByText(/No searches yet/)).toBeInTheDocument();
  });

  it("renders previous session rows when sessions exist", () => {
    researchHooksMock.useResearchSessions.mockReturnValueOnce({
      data: [
        {
          id: "sess-1",
          query: "burnout prevalence",
          status: "complete",
          sessionType: "literature",
          createdAt: "2026-05-01T10:00:00.000Z",
          completedAt: "2026-05-01T10:01:00.000Z",
        },
      ],
      isLoading: false,
      error: null,
    });

    render(<ResearchPage />);

    expect(screen.getByText("burnout prevalence")).toBeInTheDocument();
  });
});

