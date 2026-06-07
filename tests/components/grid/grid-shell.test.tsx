// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GridShell,
  persistGridColumnOrder,
  reorderGridColumns,
  type GridShellColumn,
} from "@/components/grid/grid-shell";

const columns: GridShellColumn[] = [
  { id: "column-a", question: "What is working?", position: 0 },
  { id: "column-b", question: "Where is support breaking down?", position: 1 },
  { id: "column-c", question: "What should change?", position: 2 },
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GridShell", () => {
  it("renders toolbar, empty state, evidence placeholder, and add-column dialog", () => {
    render(<GridShell roundId="round-1" columns={[]} />);

    expect(screen.getByLabelText("Analysis grid toolbar")).toBeInTheDocument();
    expect(screen.getByText("No analysis questions yet")).toBeInTheDocument();
    expect(screen.getByLabelText("Evidence panel")).toHaveTextContent("Select an insight");

    fireEvent.click(screen.getAllByRole("button", { name: "Add column" })[0]);
    expect(screen.getByRole("dialog")).toHaveTextContent("Add analysis question");
  });

  it("renders a matrix-shaped loading state", () => {
    render(<GridShell roundId="round-1" columns={[]} isLoading />);

    expect(screen.getByLabelText("Loading analysis grid")).toBeInTheDocument();
    expect(screen.queryByText("No analysis questions yet")).not.toBeInTheDocument();
  });

  it("renders sortable column headers and supplied panel content", () => {
    render(
      <GridShell
        roundId="round-1"
        columns={columns}
        matrix={<div>Matrix content</div>}
        evidencePanel={<div>Evidence content</div>}
      />
    );

    expect(screen.getByText("1. What is working?")).toBeInTheDocument();
    expect(screen.getByText("Matrix content")).toBeInTheDocument();
    expect(screen.getByLabelText("Evidence panel")).toHaveTextContent("Evidence content");
  });
});

describe("grid column ordering", () => {
  it("reorders columns and rewrites positions", () => {
    expect(reorderGridColumns(columns, "column-c", "column-a")).toEqual([
      { ...columns[2], position: 0 },
      { ...columns[0], position: 1 },
      { ...columns[1], position: 2 },
    ]);
  });

  it("patches every column whose position changed", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));
    const reordered = reorderGridColumns(columns, "column-c", "column-a");

    await persistGridColumnOrder("round-1", columns, reordered);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/client/consultations/round-1/grid/columns/column-c",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ position: 0 }),
      })
    );
  });
});
