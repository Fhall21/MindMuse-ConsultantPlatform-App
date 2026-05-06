import { describe, expect, it } from "vitest";
import type { CanvasFrame } from "@/types/canvas";
import {
  frameContainingPoint,
  nodeIdsInsideFrame,
  pointInFrameBounds,
  reconcileNodeFrameMembership,
} from "@/lib/canvas-frame-spatial";

function makeFrame(overrides: Partial<CanvasFrame> = {}): CanvasFrame {
  return {
    id: "frame-1",
    consultation_id: "c1",
    name: "F",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    color: "blue",
    node_ids: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    position: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("pointInFrameBounds", () => {
  const frame = { x: 10, y: 20, width: 100, height: 50 };

  it("includes points strictly inside", () => {
    expect(pointInFrameBounds({ x: 50, y: 30 }, frame)).toBe(true);
  });
  it("includes points on the boundary", () => {
    expect(pointInFrameBounds({ x: 10, y: 20 }, frame)).toBe(true);
    expect(pointInFrameBounds({ x: 110, y: 70 }, frame)).toBe(true);
  });
  it("excludes points outside", () => {
    expect(pointInFrameBounds({ x: 9, y: 30 }, frame)).toBe(false);
    expect(pointInFrameBounds({ x: 50, y: 71 }, frame)).toBe(false);
  });
});

describe("frameContainingPoint", () => {
  const a = makeFrame({ id: "a", x: 0, y: 0, width: 100, height: 100 });
  const b = makeFrame({ id: "b", x: 50, y: 50, width: 100, height: 100 });

  it("returns null when no frame contains the point", () => {
    expect(frameContainingPoint([a, b], { x: 200, y: 200 })).toBeNull();
  });

  it("returns the only containing frame", () => {
    expect(frameContainingPoint([a, b], { x: 10, y: 10 })?.id).toBe("a");
  });

  it("returns the topmost (last) frame on overlap", () => {
    // Both contain (60, 60); b is later in the list so it wins.
    expect(frameContainingPoint([a, b], { x: 60, y: 60 })?.id).toBe("b");
  });
});

describe("nodeIdsInsideFrame", () => {
  it("filters nodes by spatial overlap", () => {
    const frame = { x: 0, y: 0, width: 100, height: 100 };
    const nodes = [
      { id: "n1", position: { x: 50, y: 50 } },
      { id: "n2", position: { x: 200, y: 50 } },
      { id: "n3", position: { x: 99, y: 0 } },
    ];
    expect(nodeIdsInsideFrame(nodes, frame)).toEqual(["n1", "n3"]);
  });
});

describe("reconcileNodeFrameMembership", () => {
  it("assigns to the containing frame and leaves others", () => {
    const a = makeFrame({ id: "a", x: 0, y: 0, width: 100, height: 100, node_ids: ["n1"] });
    const b = makeFrame({ id: "b", x: 200, y: 200, width: 100, height: 100, node_ids: [] });
    const result = reconcileNodeFrameMembership("n1", { x: 250, y: 250 }, [a, b]);
    expect(result.assignTo?.id).toBe("b");
    expect(result.removeFrom.map((f) => f.id)).toEqual(["a"]);
  });

  it("returns null assignTo when the node is outside all frames", () => {
    const a = makeFrame({ id: "a", x: 0, y: 0, width: 50, height: 50, node_ids: ["n1"] });
    const result = reconcileNodeFrameMembership("n1", { x: 999, y: 999 }, [a]);
    expect(result.assignTo).toBeNull();
    expect(result.removeFrom.map((f) => f.id)).toEqual(["a"]);
  });

  it("does not flag the current frame for removal when membership is unchanged", () => {
    const a = makeFrame({ id: "a", x: 0, y: 0, width: 100, height: 100, node_ids: ["n1"] });
    const result = reconcileNodeFrameMembership("n1", { x: 50, y: 50 }, [a]);
    expect(result.assignTo?.id).toBe("a");
    expect(result.removeFrom).toHaveLength(0);
  });
});
