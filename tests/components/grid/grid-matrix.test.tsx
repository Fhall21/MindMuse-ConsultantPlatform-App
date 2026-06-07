// @vitest-environment jsdom

import { DndContext } from "@dnd-kit/core";
import {
  horizontalListSortingStrategy,
  SortableContext,
} from "@dnd-kit/sortable";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    createdAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "column-a",
    consultationId: "round-1",
    question: "How safe do people feel to speak up?",
    position: 0,
    createdAt: "2026-01-01T00:00:00Z",
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
  generatedAt: "2026-01-01T00:00:00Z",
};

const completeCellB: GridCellData = {
  id: "cell-b",
  meetingId: "meeting-1",
  columnId: "column-b",
  status: "complete",
  confidence: "medium",
  insightCount: 1,
  quoteCount: 2,
  generatedAt: "2026-01-01T00:00:00Z",
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
  quoteConfidence: null,
};

const insightB: InsightWithLinks = {
  id: "insight-2",
  label: "Other base label",
  description: null,
  junctionId: "junction-2",
  editedLabel: "Other cell label",
  gridReviewState: "pending",
  accepted: false,
  rejected: false,
  gridCellId: "cell-b",
  gridColumnId: "column-b",
  connectedColumns: [],
  quotes: [],
  quoteConfidence: null,
};

function renderMatrix(overrides: Partial<React.ComponentProps<typeof GridMatrix>> = {}) {
  const props: React.ComponentProps<typeof GridMatrix> = {
    columns,
    meetings: [{ id: "meeting-1", title: "Leadership interview" }],
    cells: [completeCell],
    insightsByCellId: new Map([["cell-a", [insight]]]),
    selectedCellId: "cell-a",
    selectedInsightId: null,
    onCellSelect: vi.fn(),
    onInsightSelect: vi.fn(),
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
  it("orders question headers, freezes meeting column, and deletes a column", async () => {
    const user = userEvent.setup();
    const onColumnDelete = vi.fn();
    renderMatrix({ onColumnDelete });

    const headers = screen.getAllByRole("columnheader");
    expect(headers[0]).toHaveTextContent("Meeting");
    expect(headers[0]).toHaveClass("sticky", "left-0");
    expect(headers[1]).toHaveTextContent("1. How safe do people feel to speak up?");
    expect(headers[2]).toHaveTextContent("2. Where is support breaking down?");

    await user.click(
      screen.getByRole("button", {
        name: "Column actions: How safe do people feel to speak up?",
      })
    );
    await user.click(await screen.findByRole("menuitem", { name: "Delete column" }));
    expect(onColumnDelete).toHaveBeenCalledWith("column-a");
  });

  it("selects cells but keeps review controls from bubbling", () => {
    const onCellSelect = vi.fn();
    const onInsightReview = vi.fn();
    renderMatrix({ onCellSelect, onInsightReview });

    expect(screen.getByText("Cell-specific label")).toBeInTheDocument();
    expect(screen.getByText("3 quotes")).toBeInTheDocument();
    expect(screen.getByText("High evidence")).toBeInTheDocument();

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

  it("shows insight labels in non-selected cells", () => {
    renderMatrix({
      cells: [completeCell, completeCellB],
      insightsByCellId: new Map([
        ["cell-a", [insight]],
        ["cell-b", [insightB]],
      ]),
      selectedCellId: "cell-a",
    });

    expect(screen.getByText("Cell-specific label")).toBeInTheDocument();
    expect(screen.getByText("Other cell label")).toBeInTheDocument();
  });

  it("fires onInsightSelect when an insight row is clicked", () => {
    const onInsightSelect = vi.fn();
    renderMatrix({ onInsightSelect });

    fireEvent.click(screen.getByText("Cell-specific label"));

    expect(onInsightSelect).toHaveBeenCalledWith("cell-a", "insight-1");
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
          selectedInsightId={null}
          onSelect={vi.fn()}
          onInsightSelect={vi.fn()}
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
          selectedInsightId={null}
          onSelect={onSelect}
          onInsightSelect={vi.fn()}
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
          isSelected={false}
          onSelect={vi.fn()}
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
          isSelected={false}
          onSelect={vi.fn()}
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
