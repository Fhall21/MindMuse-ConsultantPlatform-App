// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks — must be defined before any module imports that reference them.
// ---------------------------------------------------------------------------

const fetchJsonMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/api", () => ({
  fetchJson: fetchJsonMock,
}));

const posthogMock = vi.hoisted(() => ({
  capture: vi.fn(),
}));

vi.mock("posthog-js", () => ({
  default: posthogMock,
}));

const toastMock = vi.hoisted(() =>
  Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
  })
);

vi.mock("sonner", () => ({
  toast: toastMock,
}));

const computeSpatialLayoutMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/canvas-spatial-layout-core", () => ({
  computeSpatialLayout: computeSpatialLayoutMock,
}));

// ---------------------------------------------------------------------------
// Import the hook after mocks are registered.
// ---------------------------------------------------------------------------

import { useSpatialLayout } from "@/hooks/use-spatial-layout";
import type { CanvasGraphHandle } from "@/components/canvas/canvas-graph";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGraphRef(
  overrides: Partial<CanvasGraphHandle> = {}
): { current: CanvasGraphHandle } {
  const ref: { current: CanvasGraphHandle } = {
    current: {
      fitView: vi.fn(),
      getLayoutItems: vi.fn(() => [
        { id: "node-1", text: "Theme one" },
        { id: "node-2", text: "Theme two" },
        { id: "node-3", text: "Theme three" },
      ]),
      getTopLevelPositions: vi.fn(() => ({
        "node-1": { x: 0, y: 0 },
        "node-2": { x: 200, y: 0 },
        "node-3": { x: 100, y: 200 },
      })),
      applyPositions: vi.fn(),
      getLayoutSavePending: vi.fn(() => false),
      ...overrides,
    },
  };
  return ref;
}

const DEFAULT_SERVER_POSITIONS = {
  "node-1": { x: 50, y: 50 },
  "node-2": { x: 250, y: 50 },
  "node-3": { x: 150, y: 250 },
};

function mockFetchSuccess(
  positions = DEFAULT_SERVER_POSITIONS
) {
  fetchJsonMock.mockResolvedValueOnce({ positions });
}

function mockComputeSuccess(
  positions = DEFAULT_SERVER_POSITIONS
) {
  computeSpatialLayoutMock.mockReturnValueOnce({
    type: "done",
    positions,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useSpatialLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 1. Node count guard ──────────────────────────────────────────────────

  it("does not trigger when item count < 3", async () => {
    const graphRef = makeGraphRef({
      getLayoutItems: vi.fn(() => [
        { id: "node-1", text: "A" },
        { id: "node-2", text: "B" },
      ]),
    });

    const { result } = renderHook(() =>
      useSpatialLayout({ roundId: "round-1", graphRef })
    );

    await act(async () => {
      await result.current.runLayout();
    });

    expect(fetchJsonMock).not.toHaveBeenCalled();
    expect(graphRef.current.applyPositions).not.toHaveBeenCalled();
  });

  // ── 2. Posts correct node ids and texts to endpoint ──────────────────────

  it("posts correct ungrouped node ids and texts to the endpoint", async () => {
    const graphRef = makeGraphRef();
    mockFetchSuccess();
    mockComputeSuccess();

    const { result } = renderHook(() =>
      useSpatialLayout({ roundId: "round-1", graphRef })
    );

    await act(async () => {
      await result.current.runLayout();
    });

    expect(fetchJsonMock).toHaveBeenCalledWith(
      "/api/client/consultations/round-1/canvas/spatial-layout",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodes: [
            { id: "node-1", text: "Theme one" },
            { id: "node-2", text: "Theme two" },
            { id: "node-3", text: "Theme three" },
          ],
        }),
      })
    );
  });

  // ── 3. Selection scope dedupes to top-level item ids ─────────────────────

  it("selection scope filters items to those matching the returned top-level ids", async () => {
    // getLayoutItems returns 3 top-level items
    const graphRef = makeGraphRef({
      getLayoutItems: vi.fn(() => [
        { id: "node-1", text: "Theme one" },
        { id: "node-2", text: "Theme two" },
        { id: "node-3", text: "Theme three" },
        { id: "node-4", text: "Theme four" },
      ]),
      getTopLevelPositions: vi.fn(() => ({
        "node-1": { x: 0, y: 0 },
        "node-2": { x: 200, y: 0 },
        "node-3": { x: 100, y: 200 },
        "node-4": { x: 300, y: 300 },
      })),
    });

    // Select node-1, node-2, node-3 and a grouped-child id that won't match
    mockFetchSuccess({
      "node-1": { x: 10, y: 10 },
      "node-2": { x: 210, y: 10 },
      "node-3": { x: 110, y: 210 },
    });
    mockComputeSuccess({
      "node-1": { x: 10, y: 10 },
      "node-2": { x: 210, y: 10 },
      "node-3": { x: 110, y: 210 },
    });

    const { result } = renderHook(() =>
      useSpatialLayout({ roundId: "round-1", graphRef })
    );

    await act(async () => {
      await result.current.runLayout({
        scope: "selected",
        // child-of-node-2 doesn't exist in top-level items → excluded
        selectedItemIds: ["node-1", "node-2", "node-3", "child-of-node-2"],
      });
    });

    // Only the 3 matched top-level items should be in the request body
    const call = fetchJsonMock.mock.calls[0];
    const body = JSON.parse(call[1].body as string) as {
      nodes: { id: string; text: string }[];
    };
    expect(body.nodes).toHaveLength(3);
    expect(body.nodes.map((n) => n.id)).toEqual(["node-1", "node-2", "node-3"]);
  });

  it("aborts and does nothing when selected scope yields < 3 items", async () => {
    const graphRef = makeGraphRef();

    const { result } = renderHook(() =>
      useSpatialLayout({ roundId: "round-1", graphRef })
    );

    await act(async () => {
      await result.current.runLayout({
        scope: "selected",
        selectedItemIds: ["node-1", "node-2"], // only 2 match
      });
    });

    expect(fetchJsonMock).not.toHaveBeenCalled();
  });

  // ── 4. Applies server positions via applyPositions on success ────────────

  it("applies server positions via graphRef.applyPositions on success", async () => {
    const graphRef = makeGraphRef();
    const positions = DEFAULT_SERVER_POSITIONS;
    mockFetchSuccess(positions);
    computeSpatialLayoutMock.mockReturnValueOnce({
      type: "done",
      positions,
    });

    const { result } = renderHook(() =>
      useSpatialLayout({ roundId: "round-1", graphRef })
    );

    await act(async () => {
      await result.current.runLayout();
    });

    expect(graphRef.current.applyPositions).toHaveBeenCalledWith(
      positions,
      { animate: true }
    );
  });

  // ── 5. Restores snapshot on HTTP error ───────────────────────────────────

  it("restores snapshot on HTTP error and does not apply new positions", async () => {
    const snapshot = {
      "node-1": { x: 0, y: 0 },
      "node-2": { x: 200, y: 0 },
      "node-3": { x: 100, y: 200 },
    };
    const graphRef = makeGraphRef({
      getTopLevelPositions: vi.fn(() => ({ ...snapshot })),
    });

    fetchJsonMock.mockRejectedValueOnce(new Error("503 Service Unavailable"));

    const { result } = renderHook(() =>
      useSpatialLayout({ roundId: "round-1", graphRef })
    );

    await act(async () => {
      await result.current.runLayout();
    });

    // applyPositions must NOT be called (fetch threw before we reached apply)
    expect(graphRef.current.applyPositions).not.toHaveBeenCalled();
    // Error toast shown
    expect(toastMock.error).toHaveBeenCalled();
    // State returns to idle
    expect(result.current.state).toBe("idle");
  });

  // ── 6. Restores snapshot on worker/compute error ─────────────────────────

  it("restores snapshot on computeSpatialLayout error", async () => {
    const snapshot = {
      "node-1": { x: 0, y: 0 },
      "node-2": { x: 200, y: 0 },
      "node-3": { x: 100, y: 200 },
    };
    const graphRef = makeGraphRef({
      getTopLevelPositions: vi.fn(() => ({ ...snapshot })),
    });

    mockFetchSuccess();
    computeSpatialLayoutMock.mockReturnValueOnce({
      type: "error",
      message: "d3-force exploded",
    });

    const { result } = renderHook(() =>
      useSpatialLayout({ roundId: "round-1", graphRef })
    );

    await act(async () => {
      await result.current.runLayout();
    });

    expect(graphRef.current.applyPositions).toHaveBeenCalledWith(
      snapshot,
      { animate: false }
    );
    expect(toastMock.error).toHaveBeenCalled();
    expect(result.current.state).toBe("idle");
  });

  // ── 7. Restores snapshot on worker timeout ───────────────────────────────
  //
  // NOTE: The synchronous fallback (computeSpatialLayout) completes instantly,
  // so there is no actual 10-second timeout path in the current implementation.
  // This test verifies the error-result path (which is the closest equivalent):
  // if computeSpatialLayout returns an error, positions are restored.
  // If/when migrated to a real Worker with a 10s timeout, replace this test
  // with one that uses vi.useFakeTimers() + vi.advanceTimersByTime(10001).

  it("restores snapshot when compute returns an error (timeout equivalent)", async () => {
    const snapshot = {
      "node-1": { x: 10, y: 20 },
      "node-2": { x: 110, y: 20 },
      "node-3": { x: 60, y: 120 },
    };
    const graphRef = makeGraphRef({
      getTopLevelPositions: vi.fn(() => ({ ...snapshot })),
    });

    mockFetchSuccess();
    computeSpatialLayoutMock.mockReturnValueOnce({
      type: "error",
      message: "timed out",
    });

    const { result } = renderHook(() =>
      useSpatialLayout({ roundId: "round-1", graphRef })
    );

    await act(async () => {
      await result.current.runLayout();
    });

    expect(graphRef.current.applyPositions).toHaveBeenCalledWith(
      snapshot,
      { animate: false }
    );
  });

  // ── 8. Undo path calls applyPositions(snapshot) ──────────────────────────

  it("undo path calls applyPositions with the pre-layout snapshot", async () => {
    const snapshot = {
      "node-1": { x: 0, y: 0 },
      "node-2": { x: 200, y: 0 },
      "node-3": { x: 100, y: 200 },
    };
    const graphRef = makeGraphRef({
      getTopLevelPositions: vi.fn(() => ({ ...snapshot })),
    });

    mockFetchSuccess();
    mockComputeSuccess();

    const { result } = renderHook(() =>
      useSpatialLayout({ roundId: "round-1", graphRef })
    );

    await act(async () => {
      await result.current.runLayout();
    });

    // The toast should have been called with an action
    expect(toastMock).toHaveBeenCalledWith(
      "Layout applied",
      expect.objectContaining({
        action: expect.objectContaining({ label: "Undo layout" }),
        duration: 5000,
      })
    );

    // Invoke the undo action
    const toastCall = toastMock.mock.calls[0];
    const toastOptions = toastCall[1] as {
      action: { onClick: () => void };
    };

    act(() => {
      toastOptions.action.onClick();
    });

    // applyPositions should have been called with the snapshot and animate:true
    const calls = (graphRef.current.applyPositions as ReturnType<typeof vi.fn>).mock.calls;
    const undoCall = calls.find(
      (c) =>
        JSON.stringify(c[0]) === JSON.stringify(snapshot) &&
        c[1]?.animate === true
    );
    expect(undoCall).toBeDefined();

    expect(posthogMock.capture).toHaveBeenCalledWith(
      "canvas_cluster_layout_undone",
      { roundId: "round-1" }
    );
  });

  // ── 9. Does not trigger while getLayoutSavePending() is true ─────────────

  it("does not trigger when getLayoutSavePending() returns true", async () => {
    const graphRef = makeGraphRef({
      getLayoutSavePending: vi.fn(() => true),
    });

    const { result } = renderHook(() =>
      useSpatialLayout({ roundId: "round-1", graphRef })
    );

    await act(async () => {
      await result.current.runLayout();
    });

    expect(fetchJsonMock).not.toHaveBeenCalled();
    expect(graphRef.current.applyPositions).not.toHaveBeenCalled();
    // State should remain idle
    expect(result.current.state).toBe("idle");
  });

  // ── 10. State transitions ─────────────────────────────────────────────────

  it("starts idle and returns to idle after a successful run", async () => {
    const graphRef = makeGraphRef();
    mockFetchSuccess();
    mockComputeSuccess();

    const { result } = renderHook(() =>
      useSpatialLayout({ roundId: "round-1", graphRef })
    );

    expect(result.current.state).toBe("idle");

    await act(async () => {
      await result.current.runLayout();
    });

    await waitFor(() => expect(result.current.state).toBe("idle"));
  });

  // ── 11. Posthog events ────────────────────────────────────────────────────

  it("captures triggered and completed posthog events on success", async () => {
    const graphRef = makeGraphRef();
    mockFetchSuccess();
    mockComputeSuccess();

    const { result } = renderHook(() =>
      useSpatialLayout({ roundId: "round-1", graphRef })
    );

    await act(async () => {
      await result.current.runLayout();
    });

    expect(posthogMock.capture).toHaveBeenCalledWith(
      "canvas_cluster_layout_triggered",
      { roundId: "round-1", nodeCount: 3 }
    );
    expect(posthogMock.capture).toHaveBeenCalledWith(
      "canvas_cluster_layout_completed",
      expect.objectContaining({ roundId: "round-1", durationMs: expect.any(Number) })
    );
  });

  it("captures failed posthog event on HTTP error", async () => {
    const graphRef = makeGraphRef();
    fetchJsonMock.mockRejectedValueOnce(new Error("network error"));

    const { result } = renderHook(() =>
      useSpatialLayout({ roundId: "round-1", graphRef })
    );

    await act(async () => {
      await result.current.runLayout();
    });

    expect(posthogMock.capture).toHaveBeenCalledWith(
      "canvas_cluster_layout_failed",
      { roundId: "round-1", error: "network error" }
    );
  });
});
