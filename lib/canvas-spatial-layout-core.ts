import { forceSimulation, forceX, forceY, forceCollide } from "d3-force";

export interface SpatialLayoutInput {
  nodes: { id: string }[];
  edges: { source: string; target: string }[];
  serverPositions: Record<string, { x: number; y: number }>;
  bounds?: { minX: number; minY: number; maxX: number; maxY: number };
}

export type SpatialLayoutResult =
  | { type: "done"; positions: Record<string, { x: number; y: number }> }
  | { type: "error"; message: string };

/**
 * Refine UMAP-derived server positions for canvas display.
 *
 * Strategy — preserve semantic topology, fix overlap only:
 *
 *   UMAP output:  cluster-aware positions (similar nodes near each other)
 *   This fn:      1) center UMAP layout on canvas bounds center
 *                 2) forceX/Y elastic — pull each node toward its UMAP position
 *                 3) forceCollide — push overlapping nodes apart
 *
 * Intentionally NO forceManyBody (global repulsion). That force destroys UMAP's
 * cluster structure by pushing ALL nodes away from each other uniformly, collapsing
 * semantic proximity into an undifferentiated soup. Without it, the simulation only
 * nudges nodes enough to resolve overlaps, preserving inter-cluster spacing.
 *
 *   ┌─ UMAP positions ──────────────────────────────────────────┐
 *   │  cluster A (nodes 1-4)        cluster B (nodes 5-8)       │
 *   │  ○ ○                              ○ ○                     │
 *   │  ○ ○                              ○ ○                     │
 *   └───────────────────────────────────────────────────────────┘
 *          ↓ center on bounds ↓
 *          ↓ elastic + collide ↓
 *   ┌─ result ──────────────────────────────────────────────────┐
 *   │  cluster A                        cluster B               │
 *   │  ○ ○                              ○  ○                    │
 *   │  ○  ○ (slightly nudged apart)     ○ ○                     │
 *   └───────────────────────────────────────────────────────────┘
 */
export function computeSpatialLayout(
  input: SpatialLayoutInput
): SpatialLayoutResult {
  try {
    const { nodes, serverPositions, bounds } = input;

    const fallback =
      bounds != null
        ? {
            x: (bounds.minX + bounds.maxX) / 2,
            y: (bounds.minY + bounds.maxY) / 2,
          }
        : { x: 0, y: 0 };

    // Seed nodes from server positions (fallback to bounds center)
    const clonedNodes = nodes.map((n) => {
      const pos = serverPositions[n.id];
      const x = pos && Number.isFinite(pos.x) ? pos.x : fallback.x;
      const y = pos && Number.isFinite(pos.y) ? pos.y : fallback.y;
      return { id: n.id, x, y };
    });

    // Center the UMAP layout on the canvas bounds center.
    // Python normalises to a fixed viewport starting at (PADDING, PADDING);
    // without this offset, all nodes land in one corner of the canvas.
    if (clonedNodes.length > 0) {
      const xs = clonedNodes.map((n) => n.x);
      const ys = clonedNodes.map((n) => n.y);
      const layoutCx = (Math.min(...xs) + Math.max(...xs)) / 2;
      const layoutCy = (Math.min(...ys) + Math.max(...ys)) / 2;
      const dx = fallback.x - layoutCx;
      const dy = fallback.y - layoutCy;
      for (const node of clonedNodes) {
        node.x += dx;
        node.y += dy;
      }
    }

    // Elastic targets: pull each node back toward its (centered) UMAP position.
    const targetX: Record<string, number> = {};
    const targetY: Record<string, number> = {};
    for (const node of clonedNodes) {
      targetX[node.id] = node.x;
      targetY[node.id] = node.y;
    }

    // Elastic (strength 0.8) + collision only — NO forceManyBody.
    // The elastic force preserves inter-cluster distances from UMAP.
    // Collision only separates overlapping nodes without disturbing the rest.
    const sim = forceSimulation(clonedNodes)
      .force(
        "x",
        forceX<{ id: string; x: number; y: number }>(
          (d) => targetX[d.id] ?? fallback.x
        ).strength(0.8)
      )
      .force(
        "y",
        forceY<{ id: string; x: number; y: number }>(
          (d) => targetY[d.id] ?? fallback.y
        ).strength(0.8)
      )
      .force("collision", forceCollide(160))
      .stop();

    // Tick for the full alpha decay cycle
    const tickCount = Math.ceil(
      Math.log(sim.alphaMin()) / Math.log(1 - sim.alphaDecay())
    );
    sim.tick(tickCount);

    // Collect results — clamp to bounds
    const positions: Record<string, { x: number; y: number }> = {};
    for (const node of clonedNodes) {
      let x = Number.isFinite(node.x) ? node.x : fallback.x;
      let y = Number.isFinite(node.y) ? node.y : fallback.y;

      if (bounds != null) {
        x = Math.min(Math.max(x, bounds.minX), bounds.maxX);
        y = Math.min(Math.max(y, bounds.minY), bounds.maxY);
      }

      positions[node.id] = { x, y };
    }

    return { type: "done", positions };
  } catch (err) {
    return {
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
