import { z } from "zod";

export const previewCanvasSchema = z.object({
  consultation_id: z.string().uuid(),
});

export interface CanvasLayoutNode {
  id: string;
  label: string;
  x: number;
  y: number;
  type: string;
}

export interface CanvasLayoutEdge {
  from: string;
  to: string;
}

export interface CanvasLayoutPreview {
  consultation_id: string;
  nodes: CanvasLayoutNode[];
  edges: CanvasLayoutEdge[];
  node_count: number;
  group_count: number;
}

export function readCanvasLayoutPreview(output: unknown): CanvasLayoutPreview | null {
  if (!output || typeof output !== "object") {
    return null;
  }

  const record = output as Record<string, unknown>;
  if (typeof record.consultation_id !== "string" || !Array.isArray(record.nodes)) {
    return null;
  }

  const nodes: CanvasLayoutNode[] = [];
  for (const item of record.nodes) {
    if (!item || typeof item !== "object") continue;
    const node = item as Record<string, unknown>;
    if (
      typeof node.id !== "string" ||
      typeof node.label !== "string" ||
      typeof node.x !== "number" ||
      typeof node.y !== "number" ||
      typeof node.type !== "string"
    ) {
      continue;
    }
    nodes.push({
      id: node.id,
      label: node.label,
      x: node.x,
      y: node.y,
      type: node.type,
    });
  }

  const edges: CanvasLayoutEdge[] = [];
  if (Array.isArray(record.edges)) {
    for (const item of record.edges) {
      if (!item || typeof item !== "object") continue;
      const edge = item as Record<string, unknown>;
      if (typeof edge.from !== "string" || typeof edge.to !== "string") continue;
      edges.push({ from: edge.from, to: edge.to });
    }
  }

  return {
    consultation_id: record.consultation_id,
    nodes,
    edges,
    node_count:
      typeof record.node_count === "number" ? record.node_count : nodes.length,
    group_count:
      typeof record.group_count === "number"
        ? record.group_count
        : nodes.filter((node) => node.type === "theme").length,
  };
}
