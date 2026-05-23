import { NextResponse } from "next/server";
import { composeCanvasState } from "@/lib/data/canvas-state";
import { jsonError, requireRouteClient } from "../../../_helpers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roundId: string }> }
) {
  const { roundId: consultationId } = await params;
  const client = await requireRouteClient();
  if ("response" in client) return client.response;

  try {
    const state = await composeCanvasState(consultationId, client.userId);
    return NextResponse.json({
      consultation_id: consultationId,
      round_id: consultationId,
      nodes: state.nodes,
      edges: state.edges,
      viewport: state.viewport,
      needs_initial_layout_save: state.needs_initial_layout_save,
    });
  } catch (error) {
    console.error("[rounds/canvas/GET]", error);
    return jsonError(error instanceof Error ? error.message : "Failed to load canvas");
  }
}
