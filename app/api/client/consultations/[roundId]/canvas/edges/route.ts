import { NextResponse } from "next/server";
import { createCanvasConnection } from "@/lib/data/canvas";
import { jsonError, requireRouteClient } from "../../../../_helpers";
import { requireOwnedRound } from "@/lib/data/ownership";
import type { ConnectionType } from "@/types/canvas";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ consultationId: string }> }
) {
  const { consultationId } = await params;
  const client = await requireRouteClient();
  if ("response" in client) return client.response;

  try {
    await requireOwnedRound(consultationId, client.userId);

    const body = await request.json();
    const {
      from_node_type,
      from_node_id,
      to_node_type,
      to_node_id,
      source_node_type,
      source_node_id,
      target_node_type,
      target_node_id,
      connection_type,
      note,
    } = body;

    const resolvedFromNodeType = from_node_type ?? source_node_type;
    const resolvedFromNodeId = from_node_id ?? source_node_id;
    const resolvedToNodeType = to_node_type ?? target_node_type;
    const resolvedToNodeId = to_node_id ?? target_node_id;

    if (!resolvedFromNodeType || !resolvedFromNodeId || !resolvedToNodeType || !resolvedToNodeId || !connection_type) {
      return jsonError("Missing required fields", 400);
    }

    const edge = await createCanvasConnection(consultationId, client.userId, {
      fromNodeType: resolvedFromNodeType,
      fromNodeId: resolvedFromNodeId,
      toNodeType: resolvedToNodeType,
      toNodeId: resolvedToNodeId,
      connectionType: connection_type as ConnectionType,
      note: note || undefined,
    });

    return NextResponse.json(edge, { status: 201 });
  } catch (error) {
    console.error("[rounds/canvas/edges/POST]", error);
    return jsonError(error instanceof Error ? error.message : "Failed to create edge");
  }
}
