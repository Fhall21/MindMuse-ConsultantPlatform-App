import { composeCanvasState } from "@/lib/data/canvas-state";
import { buildCanvasReorganiseLayout } from "@/lib/canvas-layout";
import { requireOwnedConsultation } from "@/lib/data/ownership";
import { previewCanvasSchema, type CanvasLayoutPreview } from "./tools/canvas";
import type { z } from "zod";

type PreviewCanvasInput = z.infer<typeof previewCanvasSchema>;

export async function buildCanvasLayoutPreview(params: {
  userId: string;
  consultationId: string;
  layoutAction?: PreviewCanvasInput["layout_action"];
}): Promise<CanvasLayoutPreview> {
  await requireOwnedConsultation(params.consultationId, params.userId);

  const state = await composeCanvasState(params.consultationId, params.userId);
  let nodes = state.nodes;
  const edges = state.edges;

  if (params.layoutAction === "arrange" && nodes.length >= 2) {
    const arranged = buildCanvasReorganiseLayout({
      nodes,
      edges,
      selectedNodeIds: nodes.map((node) => node.id),
      direction: "LR",
    });

    if (arranged) {
      nodes = nodes.map((node) => ({
        ...node,
        position: arranged.positions[node.id] ?? node.position,
      }));
    }
  }

  const groupCount = nodes.filter((node) => node.type === "theme").length;

  return {
    consultation_id: params.consultationId,
    canvas_nodes: nodes,
    canvas_edges: edges,
    node_count: nodes.length,
    group_count: groupCount,
  };
}
