// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// next/navigation must be mocked before component import
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

// next/link must render as a plain anchor in jsdom
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock use() — React 19 async params unwrapping
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    use: (p: unknown) => {
      // If it looks like a Promise, unwrap synchronously via the mock
      if (p instanceof Promise) return { id: "sess-1" };
      return (actual.use as (p: unknown) => unknown)(p);
    },
  };
});

const hookMock = vi.hoisted(() => ({
  useResearchSession: vi.fn(),
}));

vi.mock("@/hooks/use-research", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/use-research")>();
  return { ...actual, useResearchSession: hookMock.useResearchSession };
});

// Stub heavy sub-components to keep test surface minimal
vi.mock("@/components/research/reasoning-steps", () => ({
  ReasoningSteps: () => <div data-testid="reasoning-steps" />,
}));
vi.mock("@/components/research/references-list", () => ({
  ReferencesList: () => <div data-testid="references-list" />,
}));

import ResearchSessionPage from "@/app/(app)/research/[id]/page";

const baseSession = {
  id: "sess-1",
  sessionType: "literature" as const,
  query: "Does shift work cause burnout?",
  status: "complete" as const,
  createdAt: "2026-05-01T10:00:00.000Z",
  completedAt: "2026-05-01T10:01:30.000Z",
  resultData: null,
};

describe("ResearchSessionPage", () => {
  it("shows loading skeletons while data is loading", () => {
    hookMock.useResearchSession.mockReturnValue({ data: undefined, isLoading: true, error: null });

    const { container } = render(<ResearchSessionPage params={Promise.resolve({ id: "sess-1" })} />);

    // Skeletons render as divs with animate-pulse class
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("shows error message when session fails to load", () => {
    hookMock.useResearchSession.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("Network error"),
    });

    render(<ResearchSessionPage params={Promise.resolve({ id: "sess-1" })} />);

    expect(screen.getByText(/Could not load research session/)).toBeInTheDocument();
  });

  it("shows query as heading and in-flight message for pending session", () => {
    hookMock.useResearchSession.mockReturnValue({
      data: { ...baseSession, status: "pending", resultData: null },
      isLoading: false,
      error: null,
    });

    render(<ResearchSessionPage params={Promise.resolve({ id: "sess-1" })} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Does shift work cause burnout?");
    // Multiple "Queued" nodes may exist (status badge + status signal)
    const queuedItems = screen.getAllByText(/Queued/);
    expect(queuedItems.length).toBeGreaterThan(0);
  });

  it("shows searching message for running session", () => {
    hookMock.useResearchSession.mockReturnValue({
      data: { ...baseSession, status: "running", resultData: null },
      isLoading: false,
      error: null,
    });

    render(<ResearchSessionPage params={Promise.resolve({ id: "sess-1" })} />);

    expect(screen.getByText(/Searching scientific databases/)).toBeInTheDocument();
  });

  it("shows error message for failed session", () => {
    hookMock.useResearchSession.mockReturnValue({
      data: {
        ...baseSession,
        status: "failed",
        resultData: { error: "Edison API timeout" },
      },
      isLoading: false,
      error: null,
    });

    render(<ResearchSessionPage params={Promise.resolve({ id: "sess-1" })} />);

    expect(screen.getByText("Edison API timeout")).toBeInTheDocument();
  });

  it("shows result tabs for complete session with result data", () => {
    hookMock.useResearchSession.mockReturnValue({
      data: {
        ...baseSession,
        status: "complete",
        resultData: {
          answer: "Shift work is associated with elevated burnout rates.",
          reasoning_steps: [{ title: "Step 1", body: "..." }],
          evidence: [{ source: "Smith 2024", excerpt: "...", score: 0.9 }],
          references: [{ title: "Smith 2024", authors: "Smith", year: 2024, doi: null, url: null }],
          artifact: null,
        },
      },
      isLoading: false,
      error: null,
    });

    render(<ResearchSessionPage params={Promise.resolve({ id: "sess-1" })} />);

    expect(screen.getByRole("tab", { name: /Results/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Reasoning/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Evidence/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /References/ })).toBeInTheDocument();
  });

  it("shows plain fallback when complete but result data is null", () => {
    hookMock.useResearchSession.mockReturnValue({
      data: { ...baseSession, status: "complete", resultData: null },
      isLoading: false,
      error: null,
    });

    render(<ResearchSessionPage params={Promise.resolve({ id: "sess-1" })} />);

    expect(screen.getByText(/No results/)).toBeInTheDocument();
  });

  it("has a back link to /research", () => {
    hookMock.useResearchSession.mockReturnValue({
      data: baseSession,
      isLoading: false,
      error: null,
    });

    render(<ResearchSessionPage params={Promise.resolve({ id: "sess-1" })} />);

    const link = screen.getByRole("link", { name: /Research/ });
    expect(link).toHaveAttribute("href", "/research");
  });
});
