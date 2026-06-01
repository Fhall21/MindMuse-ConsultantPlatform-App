import { composeCanvasState } from "@/lib/data/canvas-state";
import { requireOwnedConsultation } from "@/lib/data/ownership";
import type { CanvasLayoutPreview } from "./tools/canvas";

export async function buildCanvasLayoutPreview(params: {
  userId: string;
  consultationId: string;
}): Promise<CanvasLayoutPreview> {
  await requireOwnedConsultation(params.consultationId, params.userId);

  const state = await composeCanvasState(params.consultationId, params.userId);

  const nodes = state.nodes.map((node) => ({
    id: node.id,
    label: node.label,
    x: node.position.x,
    y: node.position.y,
    type: node.type,
  }));

  const edges = state.edges.map((edge) => ({
    from: edge.source_node_id,
    to: edge.target_node_id,
  }));

  const groupCount = nodes.filter((node) => node.type === "theme").length;

  return {
    consultation_id: params.consultationId,
    nodes,
    edges,
    node_count: nodes.length,
    group_count: groupCount,
  };
}
