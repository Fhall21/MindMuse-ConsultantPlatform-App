import { describe, it, expect } from "vitest";
import {
  computeSpatialLayout,
  type SpatialLayoutInput,
} from "@/lib/canvas-spatial-layout-core";

describe("computeSpatialLayout", () => {
  it("returns done with finite positions for valid input", () => {
    const input: SpatialLayoutInput = {
      nodes: [{ id: "a" }, { id: "b" }, { id: "c" }],
      edges: [
        { source: "a", target: "b" },
        { source: "b", target: "c" },
      ],
      serverPositions: {
        a: { x: 100, y: 100 },
        b: { x: 200, y: 150 },
        c: { x: 300, y: 100 },
      },
    };

    const result = computeSpatialLayout(input);

    expect(result.type).toBe("done");
    if (result.type === "done") {
      expect(Object.keys(result.positions)).toHaveLength(3);
      for (const id of ["a", "b", "c"]) {
        expect(Number.isFinite(result.positions[id].x)).toBe(true);
        expect(Number.isFinite(result.positions[id].y)).toBe(true);
      }
    }
  });

  it("drops edges referencing unknown node ids without throwing", () => {
    const input: SpatialLayoutInput = {
      nodes: [{ id: "a" }, { id: "b" }],
      edges: [
        { source: "a", target: "b" },
        { source: "a", target: "MISSING" }, // unknown target
        { source: "GHOST", target: "b" }, // unknown source
      ],
      serverPositions: {
        a: { x: 0, y: 0 },
        b: { x: 100, y: 0 },
      },
    };

    const result = computeSpatialLayout(input);

    expect(result.type).toBe("done");
    if (result.type === "done") {
      expect(Number.isFinite(result.positions["a"].x)).toBe(true);
      expect(Number.isFinite(result.positions["b"].x)).toBe(true);
    }
  });

  it("clamps NaN serverPositions to fallback within bounds", () => {
    const bounds = { minX: 0, minY: 0, maxX: 800, maxY: 600 };
    const input: SpatialLayoutInput = {
      nodes: [{ id: "x" }, { id: "y" }, { id: "z" }],
      edges: [],
      serverPositions: {
        x: { x: NaN, y: NaN },
        y: { x: NaN, y: NaN },
        z: { x: NaN, y: NaN },
      },
      bounds,
    };

    const result = computeSpatialLayout(input);

    expect(result.type).toBe("done");
    if (result.type === "done") {
      for (const id of ["x", "y", "z"]) {
        const pos = result.positions[id];
        expect(Number.isFinite(pos.x)).toBe(true);
        expect(Number.isFinite(pos.y)).toBe(true);
        expect(pos.x).toBeGreaterThanOrEqual(bounds.minX);
        expect(pos.x).toBeLessThanOrEqual(bounds.maxX);
        expect(pos.y).toBeGreaterThanOrEqual(bounds.minY);
        expect(pos.y).toBeLessThanOrEqual(bounds.maxY);
      }
    }
  });

  it("does not mutate caller input", () => {
    const originalEdge = { source: "a", target: "b" };
    const input: SpatialLayoutInput = {
      nodes: [{ id: "a" }, { id: "b" }, { id: "c" }],
      edges: [originalEdge, { source: "b", target: "c" }],
      serverPositions: {
        a: { x: 0, y: 0 },
        b: { x: 50, y: 50 },
        c: { x: 100, y: 100 },
      },
    };

    computeSpatialLayout(input);

    // d3-force replaces source/target with node refs on clones, not on originals
    expect(typeof input.edges[0].source).toBe("string");
    expect(typeof input.edges[0].target).toBe("string");
    expect(input.edges[0].source).toBe("a");
    expect(input.edges[0].target).toBe("b");

    // Input node objects should not have injected x/y from d3
    expect((input.nodes[0] as { id: string; x?: number }).x).toBeUndefined();

    // serverPositions unchanged
    expect(input.serverPositions["a"]).toEqual({ x: 0, y: 0 });
  });

  it("returns error when computation throws", () => {
    // Passing null as serverPositions will cause the code reading serverPositions[n.id] to throw
    const input = {
      nodes: [{ id: "a" }],
      edges: [],
      serverPositions: null as unknown as Record<string, { x: number; y: number }>,
    };

    const result = computeSpatialLayout(input);

    expect(result.type).toBe("error");
    if (result.type === "error") {
      expect(typeof result.message).toBe("string");
    }
  });
});
