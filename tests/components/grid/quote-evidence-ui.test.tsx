// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeAll } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GridCell } from "@/components/grid/grid-cell";
import { InsightCandidate } from "@/components/grid/insight-candidate";
import { QuoteCard } from "@/components/grid/quote-card";
import type { GridCell as GridCellData, InsightWithLinks } from "@/types/grid";

const quote = {
  id: "quote-1",
  exactText: "rotating shifts make my sleep unpredictable",
  speakerLabel: "Alex",
  spanStart: 6,
  spanEnd: 49,
  relevanceStrength: "strong_match" as const,
  contextBefore: "Alex: The ",
  contextAfter: " and recovery slow.",
  expandedContextBefore: "Alex: The ",
  expandedContextAfter: " and recovery slow.",
};

const insight: InsightWithLinks = {
  id: "insight-1",
  label: "Sleep disruption from rotating shifts",
  description: null,
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

const cell: GridCellData = {
  id: "cell-1",
  meetingId: "meeting-1",
  columnId: "column-1",
  status: "complete",
  confidence: "high",
  insightCount: 1,
  quoteCount: 1,
  generatedAt: "2026-01-01T00:00:00Z",
};

function renderWithUi(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe("Quote evidence UI", () => {
  it("toggles expanded quote context", () => {
    renderWithUi(<QuoteCard quote={quote} meetingId="meeting-1" />);

    expect(screen.getByText(/Alex: The /)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Expand quote context" })
    );
    expect(
      screen.getByRole("button", { name: "Collapse quote context" })
    ).toBeInTheDocument();
  });

  it("calls unlink callback from quote card", () => {
    const onUnlink = vi.fn();
    renderWithUi(
      <QuoteCard quote={quote} meetingId="meeting-1" onUnlink={onUnlink} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Unlink quote from insight" }));
    expect(onUnlink).toHaveBeenCalledWith("quote-1");
  });

  it("shows unlink help text in tooltip", () => {
    renderWithUi(
      <QuoteCard quote={quote} meetingId="meeting-1" onUnlink={vi.fn()} />
    );

    fireEvent.focus(
      screen.getByRole("button", { name: "Unlink quote from insight" })
    );
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Remove this quote from this insight. Quote stays in meeting review."
    );
  });

  it("renders insight confidence as uppercase evidence label", () => {
    renderWithUi(
      <InsightCandidate
        insight={insight}
        isSelected={false}
        onSelect={() => undefined}
        onAccept={() => undefined}
        onReject={() => undefined}
      />
    );

    expect(screen.getByText("High evidence")).toBeInTheDocument();
  });

  it("renders cell footer confidence label", () => {
    renderWithUi(
      <GridCell
        cell={cell}
        insights={[insight]}
        isSelected={false}
        selectedInsightId={null}
        onSelect={() => undefined}
        onInsightSelect={() => undefined}
        onInsightReview={() => undefined}
      />
    );

    expect(screen.getAllByText("High evidence").length).toBeGreaterThanOrEqual(1);
  });
});
