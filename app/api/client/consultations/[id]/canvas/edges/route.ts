import { NextResponse } from "next/server";
import { createCanvasConnection } from "@/lib/data/canvas";
import { jsonError, requireRouteClient } from "../../../../_helpers";
import { requireOwnedConsultation } from "@/lib/data/ownership";
import type { ConnectionType } from "@/types/canvas";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: consultationId } = await params;
  const client = await requireRouteClient();

  if ("response" in client) {
    return client.response;
  }

  try {
    await requireOwnedConsultation(consultationId, client.userId);
    const roundId = "";

    const body = await request.json();
    const {
      from_node_type,
      from_node_id,
      to_node_type,
      to_node_id,
      connection_type,
      note,
    } = body;

    if (
      !from_node_type ||
      !from_node_id ||
      !to_node_type ||
      !to_node_id ||
      !connection_type
    ) {
      return jsonError("Missing required fields", 400);
    }

    const edge = await createCanvasConnection(
      roundId,
      client.userId,
      {
        fromNodeType: from_node_type,
        fromNodeId: from_node_id,
        toNodeType: to_node_type,
        toNodeId: to_node_id,
        connectionType: connection_type as ConnectionType,
        note: note || undefined,
      }
    );

    return NextResponse.json(edge, { status: 201 });
  } catch (error) {
    console.error("[edges/POST]", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to create edge"
    );
  }
}
