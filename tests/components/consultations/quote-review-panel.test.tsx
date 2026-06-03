// @vitest-environment jsdom

import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuoteReviewPanel } from "@/components/consultations/quote-review-panel";

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

vi.mock("@/hooks/use-quotes", () => ({
  useMeetingQuotes: () => ({
    data: [suggestedQuote],
  }),
  useCreateQuote: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useApproveQuote: () => ({ mutateAsync: approveQuoteMock, isPending: false }),
  useRejectQuote: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useLinkQuoteInsight: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUnlinkQuoteInsight: () => ({ mutateAsync: vi.fn(), isPending: false }),
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
    render(<QuoteReviewPanel meetingId="meeting-1" />);

    await user.click(screen.getByRole("button", { name: "Link or create insight (optional)" }));

    expect(screen.getByRole("checkbox", { name: "Link to Accepted theme" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Link to Pending draft theme" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Link to Rejected theme" })).not.toBeInTheDocument();
  });

  it("creates a new insight from quote mode and approves the quote with that primary link", async () => {
    const user = userEvent.setup();
    render(<QuoteReviewPanel meetingId="meeting-1" />);

    await user.click(screen.getByRole("button", { name: "Link or create insight (optional)" }));
    await user.type(screen.getByPlaceholderText("New insight"), "Tool handoff friction");
    await user.click(screen.getByRole("button", { name: "Add" }));
    await user.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => {
      expect(createInsightMock).toHaveBeenCalledWith({ label: "Tool handoff friction" });
      expect(approveQuoteMock).toHaveBeenCalledWith({
        quoteId: "quote-1",
        primaryInsightId: "insight-new",
        additionalInsightIds: [],
      });
    });
  });
});
