import { NextResponse } from "next/server";
import {
  updateCanvasConnection,
  deleteCanvasConnection,
} from "@/lib/data/canvas";
import { jsonError, requireRouteClient } from "../../../../../_helpers";
import { requireOwnedConsultation } from "@/lib/data/ownership";
import type { ConnectionType } from "@/types/canvas";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; edgeId: string }> }
) {
  const { id: consultationId, edgeId } = await params;
  const client = await requireRouteClient();

  if ("response" in client) {
    return client.response;
  }

  try {
    // Verify consultation ownership
    await requireOwnedConsultation(consultationId, client.userId);

    // TODO: Get roundId from consultation
    const roundId = ""; // Will be fetched from consultation

    const body = await request.json();
    const { connection_type, note } = body;

    const edge = await updateCanvasConnection(
      roundId,
      client.userId,
      edgeId,
      {
        connectionType: connection_type as ConnectionType | undefined,
        note: note !== undefined ? note : undefined,
      }
    );

    return NextResponse.json(edge);
  } catch (error) {
    console.error("[edges/[edgeId]/PATCH]", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to update edge"
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; edgeId: string }> }
) {
  const { id: consultationId, edgeId } = await params;
  const client = await requireRouteClient();

  if ("response" in client) {
    return client.response;
  }

  try {
    // Verify consultation ownership
    await requireOwnedConsultation(consultationId, client.userId);

    // TODO: Get roundId from consultation
    const roundId = ""; // Will be fetched from consultation

    await deleteCanvasConnection(roundId, client.userId, edgeId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[edges/[edgeId]/DELETE]", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to delete edge"
    );
  }
}
