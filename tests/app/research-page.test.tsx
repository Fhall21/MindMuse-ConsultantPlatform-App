// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ResearchPage from "@/app/(app)/research/page";

vi.mock("@/hooks/use-ai-preferences", () => ({
  useAIPreferences: () => ({ data: null }),
}));

vi.mock("@/hooks/use-research", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/use-research")>();
  return {
    ...actual,
    useLiteratureResearch: () => ({
      status: "idle" as const,
      result: null,
      error: null,
      elapsedSeconds: 0,
      reasoningSteps: [],
      sessionId: null,
      submit: vi.fn(),
      reset: vi.fn(),
    }),
  };
});

describe("ResearchPage", () => {
  it("renders Literature and Data Analysis tabs", () => {
    render(<ResearchPage />);

    expect(screen.getByRole("heading", { name: "Research" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/What does the literature say about/)).toBeInTheDocument();
  });

  it("switches to Data Analysis tab", () => {
    render(<ResearchPage />);

    fireEvent.click(screen.getByRole("tab", { name: "Data Analysis" }));

    expect(screen.getByText("Edison-backed data analysis will appear here.")).toBeInTheDocument();
  });

  it("renders search button in Literature tab", () => {
    render(<ResearchPage />);

    expect(screen.getByRole("button", { name: /Search literature/i })).toBeInTheDocument();
  });
});
