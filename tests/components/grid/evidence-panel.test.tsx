// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EvidencePanel } from "@/components/grid/evidence-panel";
import type { GridCell, InsightWithLinks } from "@/types/grid";

const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}));

const unlinkMutate = vi.fn();
const linkMutate = vi.fn();
vi.mock("@/hooks/use-quotes", () => ({
  useUnlinkQuoteInsight: () => ({
    mutate: unlinkMutate,
    isPending: false,
  }),
  useLinkQuoteInsight: () => ({
    mutate: linkMutate,
    isPending: false,
  }),
}));

const quote = {
  id: "quote-1",
  exactText: "rotating shifts make my sleep unpredictable",
  speakerLabel: "Alex",
  spanStart: 6,
  spanEnd: 49,
  relevanceStrength: "strong_match" as const,
  contextBefore: "Alex: The ",
  contextAfter: " and recovery slow.",
};

const insight: InsightWithLinks = {
  id: "insight-1",
  label: "Sleep disruption from rotating shifts",
  description: "Rotating shifts made sleep unpredictable and slowed recovery.",
  junctionId: "junction-1",
  editedLabel: null,
  gridReviewState: "pending",
  accepted: false,
  rejected: false,
  gridCellId: "cell-1",
  gridColumnId: "column-1",
  connectedColumns: [],
  quotes: [quote],
  quoteConfidence: "high",
};

const cell: GridCell = {
  id: "cell-1",
  meetingId: "meeting-1",
  columnId: "column-1",
  status: "complete",
  confidence: "high",
  insightCount: 1,
  quoteCount: 1,
  generatedAt: "2026-01-01T00:00:00Z",
};

function renderPanel() {
  return render(
    <TooltipProvider>
      <EvidencePanel
        roundId="round-1"
        selectedCell={cell}
        selectedInsight={insight}
        onInsightSelect={() => undefined}
        onInsightReview={() => undefined}
        insights={[insight]}
      />
    </TooltipProvider>
  );
}

describe("EvidencePanel unlink", () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    unlinkMutate.mockReset();
    linkMutate.mockReset();
    unlinkMutate.mockImplementation((_params, options) => {
      options?.onSuccess?.();
    });
  });

  it("shows undo toast after unlink with preserved link metadata", () => {
    renderPanel();

    expect(
      screen.getByText("Rotating shifts made sleep unpredictable and slowed recovery.")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Unlink quote from insight" }));

    expect(unlinkMutate).toHaveBeenCalledWith(
      { quoteId: "quote-1", insightId: "insight-1" },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
    expect(toastSuccess).toHaveBeenCalledWith("Quote removed from this insight", {
      duration: 30000,
      action: {
        label: "Undo",
        onClick: expect.any(Function),
      },
    });

    const toastOptions = toastSuccess.mock.calls[0]?.[1] as {
      action: { onClick: () => void };
    };
    toastOptions.action.onClick();

    expect(linkMutate).toHaveBeenCalledWith({
      quoteId: "quote-1",
      insightId: "insight-1",
      isPrimary: true,
      linkType: "provisional",
      relevanceStrength: "strong_match",
    });
  });
});
