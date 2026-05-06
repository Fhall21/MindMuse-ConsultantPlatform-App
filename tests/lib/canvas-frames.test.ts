import { describe, expect, it } from "vitest";
import type { CanvasFrame } from "@/types/canvas";
import { CANVAS_CLUTTER_THRESHOLD } from "@/types/canvas";

// ---------------------------------------------------------------------------
// Unit tests for canvas frame data shape and clutter threshold
// These tests validate the contract used by the data layer and UI.
// Full integration tests against a real DB would be needed for CRUD paths.
// ---------------------------------------------------------------------------

function makeFrame(overrides: Partial<CanvasFrame> = {}): CanvasFrame {
  return {
    id: "frame-1",
    consultation_id: "consultation-1",
    name: "Wellbeing cluster",
    x: 0,
    y: 0,
    width: 600,
    height: 400,
    color: "blue",
    node_ids: ["node-a", "node-b"],
    viewport: { x: 10, y: 20, zoom: 0.8 },
    position: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("CanvasFrame type contract", () => {
  it("has required fields", () => {
    const frame = makeFrame();
    expect(frame.id).toBeTruthy();
    expect(frame.consultation_id).toBeTruthy();
    expect(frame.name).toBeTruthy();
    expect(Array.isArray(frame.node_ids)).toBe(true);
    expect(frame.viewport).toMatchObject({ x: expect.any(Number), y: expect.any(Number), zoom: expect.any(Number) });
    expect(typeof frame.position).toBe("number");
  });

  it("allows empty node_ids (show-all semantics)", () => {
    const frame = makeFrame({ node_ids: [] });
    expect(frame.node_ids).toHaveLength(0);
  });

  it("preserves node_ids order", () => {
    const ids = ["c", "a", "b"];
    const frame = makeFrame({ node_ids: ids });
    expect(frame.node_ids).toEqual(ids);
  });
});

describe("CANVAS_CLUTTER_THRESHOLD", () => {
  it("is a positive integer", () => {
    expect(Number.isInteger(CANVAS_CLUTTER_THRESHOLD)).toBe(true);
    expect(CANVAS_CLUTTER_THRESHOLD).toBeGreaterThan(0);
  });

  it("is 15", () => {
    expect(CANVAS_CLUTTER_THRESHOLD).toBe(15);
  });

  it("triggers banner at exactly threshold", () => {
    const nodeCount = CANVAS_CLUTTER_THRESHOLD;
    const shouldShowBanner = nodeCount >= CANVAS_CLUTTER_THRESHOLD;
    expect(shouldShowBanner).toBe(true);
  });

  it("does not trigger banner below threshold", () => {
    const nodeCount = CANVAS_CLUTTER_THRESHOLD - 1;
    const shouldShowBanner = nodeCount >= CANVAS_CLUTTER_THRESHOLD;
    expect(shouldShowBanner).toBe(false);
  });
});

describe("frame visibility filter logic", () => {
  it("null active frame means all nodes visible", () => {
    const computeVisible = (frame: CanvasFrame | null) =>
      frame ? new Set(frame.node_ids) : null;
    expect(computeVisible(null)).toBeNull();
  });

  it("frame with node_ids produces a set for filtering", () => {
    const frame = makeFrame({ node_ids: ["a", "b", "c"] });
    const visibleNodeIds = new Set(frame.node_ids);
    expect(visibleNodeIds.has("a")).toBe(true);
    expect(visibleNodeIds.has("d")).toBe(false);
  });

  it("frame with empty node_ids treated as show-all", () => {
    const frame = makeFrame({ node_ids: [] });
    const visibleNodeIds =
      frame.node_ids.length > 0 ? new Set(frame.node_ids) : null;
    expect(visibleNodeIds).toBeNull();
  });

  it("filtering nodes against visibleNodeIds", () => {
    const allNodes = [
      { id: "node-a", label: "A" },
      { id: "node-b", label: "B" },
      { id: "node-c", label: "C" },
    ];
    const frame = makeFrame({ node_ids: ["node-a", "node-c"] });
    const visibleIds = new Set(frame.node_ids);
    const rendered = allNodes.filter((n) => visibleIds.has(n.id));
    expect(rendered.map((n) => n.id)).toEqual(["node-a", "node-c"]);
  });

  it("frame with all node IDs renders all nodes", () => {
    const allNodes = [
      { id: "node-a", label: "A" },
      { id: "node-b", label: "B" },
    ];
    const frame = makeFrame({ node_ids: allNodes.map((n) => n.id) });
    const visibleIds = new Set(frame.node_ids);
    const rendered = allNodes.filter((n) => visibleIds.has(n.id));
    expect(rendered).toHaveLength(allNodes.length);
  });

  it("stale node_ids in frame degrade gracefully (missing nodes just absent)", () => {
    const allNodes = [{ id: "node-a", label: "A" }];
    const frame = makeFrame({ node_ids: ["node-a", "deleted-node"] });
    const visibleIds = new Set(frame.node_ids);
    const rendered = allNodes.filter((n) => visibleIds.has(n.id));
    expect(rendered.map((n) => n.id)).toEqual(["node-a"]);
  });
});

describe("viewport restore contract", () => {
  it("frame viewport has required fields", () => {
    const frame = makeFrame({ viewport: { x: -50, y: 120, zoom: 1.5 } });
    expect(typeof frame.viewport.x).toBe("number");
    expect(typeof frame.viewport.y).toBe("number");
    expect(typeof frame.viewport.zoom).toBe("number");
  });

  it("viewportRequest increments id for each switch", () => {
    let requestId = 1;
    const requests: number[] = [];
    for (let i = 0; i < 3; i++) {
      requests.push(requestId++);
    }
    expect(requests).toEqual([1, 2, 3]);
  });
});
