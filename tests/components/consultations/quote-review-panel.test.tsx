// @vitest-environment jsdom

import { useState, useEffect } from "react";
import userEvent from "@testing-library/user-event";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuoteReviewPanel } from "@/components/consultations/quote-review-panel";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

const approveQuoteMock = vi.fn();
const createInsightMock = vi.fn();

const mockThemes = vi.hoisted(() => [
  {
    id: "insight-accepted",
    label: "Accepted theme",
    accepted: true,
    rejected: false,
  },
  {
    id: "insight-pending",
    label: "Pending draft theme",
    accepted: false,
    rejected: false,
  },
  {
    id: "insight-rejected",
    label: "Rejected theme",
    accepted: false,
    rejected: true,
  },
  {
    id: "insight-new",
    label: "Tool handoff friction",
    accepted: true,
    rejected: false,
  },
]);

const suggestedQuote = {
  id: "quote-1",
  meetingId: "meeting-1",
  spanStart: 0,
  spanEnd: 42,
  exactText: "The handoff kept moving between different tools.",
  speakerLabel: "Analyst",
  workGroupLabel: null,
  personId: null,
  status: "suggested" as const,
  source: "ai" as const,
  anonymousMaskRule: "role_workgroup" as const,
  riskFlag: false,
  riskReason: null,
  rejectionReason: null,
  approvedAt: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  links: [],
};

const mockQuotesState = vi.hoisted(() => ({
  current: [] as any[],
}));

let testQuotesListener: ((quotes: any[]) => void) | null = null;

function updateMockQuotes(updater: (quotes: any[]) => void) {
  updater(mockQuotesState.current);
  if (testQuotesListener) {
    testQuotesListener([...mockQuotesState.current]);
  }
}

vi.mock("@/hooks/use-meetings", () => ({
  useMeeting: () => ({
    data: {
      meeting: {
        transcript_raw: "The handoff kept moving between different tools.",
      },
    },
    isLoading: false,
  }),
}));

vi.mock("@/hooks/use-people", () => ({
  useMeetingPeople: () => ({
    data: [{ id: "person-1", name: "Analyst" }],
    isLoading: false,
  }),
}));

vi.mock("@/hooks/use-quotes", () => ({
  useMeetingQuotes: () => {
    const [quotes, setQuotes] = useState(mockQuotesState.current);
    useEffect(() => {
      testQuotesListener = setQuotes;
      return () => {
        testQuotesListener = null;
      };
    }, []);
    return { data: quotes };
  },
  useCreateQuote: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useApproveQuote: () => ({ mutateAsync: approveQuoteMock, isPending: false }),
  useRejectQuote: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useLinkQuoteInsight: () => ({
    mutateAsync: vi.fn().mockImplementation(async ({ quoteId, insightId, isPrimary, relevanceStrength }) => {
      updateMockQuotes((quotes) => {
        const q = quotes.find((x) => x.id === quoteId);
        if (q) {
          q.links = [
            ...q.links.filter((l: any) => l.insightId !== insightId),
            { insightId, isPrimary, relevanceStrength },
          ];
        }
      });
    }),
    isPending: false,
  }),
  useUnlinkQuoteInsight: () => ({
    mutateAsync: vi.fn().mockImplementation(async ({ quoteId, insightId }) => {
      updateMockQuotes((quotes) => {
        const q = quotes.find((x) => x.id === quoteId);
        if (q) {
          q.links = q.links.filter((l: any) => l.insightId !== insightId);
        }
      });
    }),
    isPending: false,
  }),
  useUpdateQuoteSpeaker: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateQuoteSpan: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/use-themes", () => ({
  useMeetingThemes: () => ({
    data: mockThemes,
    refetch: () =>
      Promise.resolve({
        data: mockThemes,
      }),
  }),
  useCreateMeetingTheme: () => ({
    mutateAsync: createInsightMock,
    isPending: false,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("QuoteReviewPanel insight linking", () => {
  beforeEach(() => {
    mockQuotesState.current = [JSON.parse(JSON.stringify(suggestedQuote))];
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
      },
    });
    Element.prototype.scrollIntoView = vi.fn();
    approveQuoteMock.mockReset();
    createInsightMock.mockResolvedValue({ id: "insight-new" });
  });

  it("shows only accepted insights in the quote link picker", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<QuoteReviewPanel meetingId="meeting-1" />);

    await user.click(screen.getByText("The handoff kept moving between different tools."));

    expect(screen.getByRole("checkbox", { name: "Link to Accepted theme" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Link to Pending draft theme" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Link to Rejected theme" })).not.toBeInTheDocument();
  });

  it("creates a new insight from quote mode and approves the quote with that primary link", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<QuoteReviewPanel meetingId="meeting-1" />);

    await user.click(screen.getByText("The handoff kept moving between different tools."));

    await user.type(screen.getByPlaceholderText("New insight"), "Tool handoff friction");
    await user.click(screen.getByRole("button", { name: "Add" }));
    await user.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => {
      expect(createInsightMock).toHaveBeenCalledWith({ label: "Tool handoff friction" });
      expect(approveQuoteMock).toHaveBeenCalledWith({
        quoteId: "quote-1",
        primaryInsightId: "insight-new",
        additionalInsightIds: [],
        relevanceStrength: null,
      });
    });
  });

  it("focuses quote on transcript click and closes the detail pane", async () => {
    const user = userEvent.setup();
    const { container } = renderWithQueryClient(<QuoteReviewPanel meetingId="meeting-1" />);

    const highlightedQuote = container.querySelector<HTMLElement>(
      'span[data-quote-id="quote-1"]'
    );
    expect(highlightedQuote).not.toBeNull();
    await user.click(highlightedQuote!);

    expect(screen.getByRole("combobox")).toHaveValue("Analyst");

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
});
