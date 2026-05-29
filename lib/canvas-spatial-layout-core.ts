import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCollide,
} from "d3-force";

export interface SpatialLayoutInput {
  nodes: { id: string }[];
  edges: { source: string; target: string }[];
  serverPositions: Record<string, { x: number; y: number }>;
  bounds?: { minX: number; minY: number; maxX: number; maxY: number };
}

export type SpatialLayoutResult =
  | { type: "done"; positions: Record<string, { x: number; y: number }> }
  | { type: "error"; message: string };

export function computeSpatialLayout(
  input: SpatialLayoutInput
): SpatialLayoutResult {
  try {
    const { nodes, edges, serverPositions, bounds } = input;

    // Build node id set for edge validation
    const nodeIds = new Set(nodes.map((n) => n.id));

    // Clone nodes; seed x/y from serverPositions (fallback 0,0)
    const clonedNodes = nodes.map((n) => {
      const pos = serverPositions[n.id];
      const x = pos && Number.isFinite(pos.x) ? pos.x : 0;
      const y = pos && Number.isFinite(pos.y) ? pos.y : 0;
      return { id: n.id, x, y };
    });

    // Clone edges; drop any referencing unknown node ids
    const clonedEdges = edges
      .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((e) => ({ source: e.source, target: e.target }));

    // Run d3-force simulation synchronously
    const sim = forceSimulation(clonedNodes)
      .force("charge", forceManyBody().strength(-300))
      .force(
        "link",
        forceLink(clonedEdges)
          .id((d) => (d as { id: string }).id)
          .distance(150)
      )
      .force("collision", forceCollide(80))
      .stop();

    // Tick for the full alpha decay cycle
    const tickCount = Math.ceil(
      Math.log(sim.alphaMin()) / Math.log(1 - sim.alphaDecay())
    );
    sim.tick(tickCount);

    // Build fallback point
    const fallback =
      bounds != null
        ? {
            x: (bounds.minX + bounds.maxX) / 2,
            y: (bounds.minY + bounds.maxY) / 2,
          }
        : { x: 200, y: 200 };

    // Collect results
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
