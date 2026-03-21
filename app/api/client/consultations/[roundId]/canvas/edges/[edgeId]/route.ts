import { NextResponse } from "next/server";
import { updateCanvasConnection, deleteCanvasConnection } from "@/lib/data/canvas";
import { jsonError, requireRouteClient } from "../../../../../_helpers";
import { requireOwnedRound } from "@/lib/data/ownership";
import type { ConnectionType } from "@/types/canvas";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ consultationId: string; edgeId: string }> }
) {
  const { consultationId, edgeId } = await params;
  const client = await requireRouteClient();
  if ("response" in client) return client.response;

  try {
    await requireOwnedRound(consultationId, client.userId);

    const body = await request.json();
    const { connection_type, note } = body;

    const edge = await updateCanvasConnection(consultationId, client.userId, edgeId, {
      connectionType: connection_type as ConnectionType | undefined,
      note: note !== undefined ? note : undefined,
    });

    return NextResponse.json(edge);
  } catch (error) {
    console.error("[rounds/canvas/edges/[edgeId]/PATCH]", error);
    return jsonError(error instanceof Error ? error.message : "Failed to update edge");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ consultationId: string; edgeId: string }> }
) {
  const { consultationId, edgeId } = await params;
  const client = await requireRouteClient();
  if ("response" in client) return client.response;

  try {
    await requireOwnedRound(consultationId, client.userId);

    await deleteCanvasConnection(consultationId, client.userId, edgeId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[rounds/canvas/edges/[edgeId]/DELETE]", error);
    return jsonError(error instanceof Error ? error.message : "Failed to delete edge");
  }
}
