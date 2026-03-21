import { NextResponse } from "next/server";
import { updateCanvasConnection, deleteCanvasConnection } from "@/lib/data/canvas";
import { jsonError, requireRouteClient } from "../../../../../_helpers";
import { requireOwnedMeeting } from "@/lib/data/ownership";
import type { ConnectionType } from "@/types/canvas";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; edgeId: string }> }
) {
  const { id: consultationId, edgeId } = await params;
  const client = await requireRouteClient();
  if ("response" in client) return client.response;

  try {
    const meeting = await requireOwnedMeeting(consultationId, client.userId);
    const consultationGroupId = meeting.consultationId;
    if (!consultationGroupId) return jsonError("Meeting has no active consultation", 400);

    const body = await request.json();
    const { connection_type, note } = body;

    const edge = await updateCanvasConnection(
      consultationGroupId,
      client.userId,
      edgeId,
      {
        connectionType: connection_type as ConnectionType | undefined,
        note: note !== undefined ? note : undefined,
      }
    );

    return NextResponse.json(edge);
  } catch (error) {
    console.error("[canvas/edges/[edgeId]/PATCH]", error);
    return jsonError(error instanceof Error ? error.message : "Failed to update edge");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; edgeId: string }> }
) {
  const { id: consultationId, edgeId } = await params;
  const client = await requireRouteClient();
  if ("response" in client) return client.response;

  try {
    const meeting = await requireOwnedMeeting(consultationId, client.userId);
    const consultationGroupId = meeting.consultationId;
    if (!consultationGroupId) return jsonError("Meeting has no active consultation", 400);

    await deleteCanvasConnection(consultationGroupId, client.userId, edgeId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[canvas/edges/[edgeId]/DELETE]", error);
    return jsonError(error instanceof Error ? error.message : "Failed to delete edge");
  }
}
