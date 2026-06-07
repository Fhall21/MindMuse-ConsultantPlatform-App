// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-quotes", () => ({
  useUnlinkQuoteInsight: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));
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

function renderGridShell(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ suggestions: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GridShell", () => {
  it("renders toolbar, empty state, and evidence placeholder", () => {
    renderGridShell(<GridShell roundId="round-1" columns={[]} />);

    expect(screen.getByLabelText("Analysis grid toolbar")).toBeInTheDocument();
    expect(screen.getByText("No analysis questions yet")).toBeInTheDocument();
    expect(screen.getByLabelText("Evidence panel")).toHaveTextContent("Select an insight");
  });

  it("opens add-column panel in aside and cancel restores evidence placeholder", () => {
    const onAddColumn = vi.fn();
    renderGridShell(
      <GridShell roundId="round-1" columns={[]} onAddColumn={onAddColumn} />
    );

    expect(screen.getByLabelText("Evidence panel")).toHaveTextContent("Select an insight");

    fireEvent.click(screen.getAllByRole("button", { name: "Add column" })[0]);

    expect(screen.getByLabelText("Add column panel")).toBeInTheDocument();
    expect(screen.getByText("Add analysis question")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByLabelText("Evidence panel")).toHaveTextContent("Select an insight");
    expect(screen.queryByLabelText("Add column panel")).not.toBeInTheDocument();
  });

  it("renders a matrix-shaped loading state", () => {
    renderGridShell(<GridShell roundId="round-1" columns={[]} isLoading />);

    expect(screen.getByLabelText("Loading analysis grid")).toBeInTheDocument();
    expect(screen.queryByText("No analysis questions yet")).not.toBeInTheDocument();
  });

  it("renders sortable column headers and supplied panel content", () => {
    renderGridShell(
      <GridShell
        roundId="round-1"
        columns={columns}
        matrix={<div>Matrix content</div>}
        evidencePanel={<div>Evidence content</div>}
        onAddColumn={vi.fn()}
      />
    );

    expect(screen.getByText("1. What is working?")).toBeInTheDocument();
    expect(screen.getByText("Matrix content")).toBeInTheDocument();
    expect(screen.getByLabelText("Evidence panel")).toHaveTextContent("Evidence content");

    fireEvent.click(screen.getByRole("button", { name: "Add column" }));

    expect(screen.getByLabelText("Add column panel")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
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
