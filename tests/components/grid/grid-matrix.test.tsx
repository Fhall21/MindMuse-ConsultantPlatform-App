// @vitest-environment jsdom

import { DndContext } from "@dnd-kit/core";
import {
  horizontalListSortingStrategy,
  SortableContext,
} from "@dnd-kit/sortable";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GridCell } from "@/components/grid/grid-cell";
import { GridMatrix } from "@/components/grid/grid-matrix";
import { InsightCandidate } from "@/components/grid/insight-candidate";
import { TooltipProvider } from "@/components/ui/tooltip";
import type {
  GridCell as GridCellData,
  GridColumn,
  InsightWithLinks,
} from "@/types/grid";

const columns: GridColumn[] = [
  {
    id: "column-b",
    consultationId: "round-1",
    question: "Where is support breaking down?",
    position: 1,
  },
  {
    id: "column-a",
    consultationId: "round-1",
    question: "How safe do people feel to speak up?",
    position: 0,
  },
];

const completeCell: GridCellData = {
  id: "cell-a",
  meetingId: "meeting-1",
  columnId: "column-a",
  status: "complete",
  confidence: "high",
  insightCount: 1,
  quoteCount: 3,
};

const insight: InsightWithLinks = {
  id: "insight-1",
  label: "Shared base label",
  description: null,
  junctionId: "junction-1",
  editedLabel: "Cell-specific label",
  gridReviewState: "pending",
  accepted: false,
  rejected: false,
  gridCellId: "cell-a",
  gridColumnId: "column-a",
  connectedColumns: [],
  quotes: [],
};

function renderMatrix(overrides: Partial<React.ComponentProps<typeof GridMatrix>> = {}) {
  const props: React.ComponentProps<typeof GridMatrix> = {
    columns,
    meetings: [{ id: "meeting-1", title: "Leadership interview" }],
    cells: [completeCell],
    selectedCellId: "cell-a",
    selectedCellInsights: [insight],
    onCellSelect: vi.fn(),
    onInsightReview: vi.fn(),
    onColumnDelete: vi.fn(),
    ...overrides,
  };

  return {
    props,
    ...render(
      <TooltipProvider>
        <DndContext>
          <SortableContext
            items={columns.map((column) => column.id)}
            strategy={horizontalListSortingStrategy}
          >
            <GridMatrix {...props} />
          </SortableContext>
        </DndContext>
      </TooltipProvider>
    ),
  };
}

describe("GridMatrix", () => {
  it("orders question headers, freezes meeting column, and deletes a column", () => {
    const onColumnDelete = vi.fn();
    renderMatrix({ onColumnDelete });

    const headers = screen.getAllByRole("columnheader");
    expect(headers[0]).toHaveTextContent("Meeting");
    expect(headers[0]).toHaveClass("sticky", "left-0");
    expect(headers[1]).toHaveTextContent("1. How safe do people feel to speak up?");
    expect(headers[2]).toHaveTextContent("2. Where is support breaking down?");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Delete column: How safe do people feel to speak up?",
      })
    );
    expect(onColumnDelete).toHaveBeenCalledWith("column-a");
  });

  it("selects cells but keeps review controls from bubbling", () => {
    const onCellSelect = vi.fn();
    const onInsightReview = vi.fn();
    renderMatrix({ onCellSelect, onInsightReview });

    expect(screen.getByText("Cell-specific label")).toBeInTheDocument();
    expect(screen.getByText("3 quotes · confidence: high")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Select analysis cell"));
    expect(onCellSelect).toHaveBeenCalledWith("cell-a");

    onCellSelect.mockClear();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Accept insight: Cell-specific label",
      })
    );

    expect(onCellSelect).not.toHaveBeenCalled();
    expect(onInsightReview).toHaveBeenCalledWith(
      "insight-1",
      "accepted",
      "cell-a",
      undefined,
      undefined
    );
  });

  it("renders missing intersections without inventing selectable cells", () => {
    renderMatrix({ cells: [] });

    expect(screen.getAllByText("Not generated")).toHaveLength(2);
    expect(screen.queryByLabelText("Select analysis cell")).not.toBeInTheDocument();
  });
});

describe("GridCell", () => {
  it.each([
    ["generating", "Extracting…"],
    ["pending", "Waiting to extract"],
    ["no_evidence", "No evidence found"],
    ["failed", "Generation failed"],
  ] as const)("renders %s state", (status, label) => {
    render(
      <TooltipProvider>
        <GridCell
          cell={{ ...completeCell, status }}
          insights={[]}
          isSelected={false}
          onSelect={vi.fn()}
          onInsightReview={vi.fn()}
        />
      </TooltipProvider>
    );

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("fires retry without selecting failed cell", () => {
    const onSelect = vi.fn();
    const onRetry = vi.fn();
    render(
      <TooltipProvider>
        <GridCell
          cell={{ ...completeCell, status: "failed" }}
          insights={[]}
          isSelected={false}
          onSelect={onSelect}
          onInsightReview={vi.fn()}
          onRetry={onRetry}
        />
      </TooltipProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry generation" }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe("InsightCandidate", () => {
  it("replaces review controls with accepted and rejected states", () => {
    const { rerender } = render(
      <TooltipProvider>
        <InsightCandidate
          insight={{ ...insight, gridReviewState: "accepted", accepted: true }}
          onAccept={vi.fn()}
          onReject={vi.fn()}
        />
      </TooltipProvider>
    );

    expect(screen.getByText("Accepted")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Accept insight/ })
    ).not.toBeInTheDocument();

    rerender(
      <TooltipProvider>
        <InsightCandidate
          insight={{ ...insight, gridReviewState: "rejected", rejected: true }}
          onAccept={vi.fn()}
          onReject={vi.fn()}
        />
      </TooltipProvider>
    );

    expect(screen.getByText("Rejected")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Reject insight/ })
    ).not.toBeInTheDocument();
  });
});
