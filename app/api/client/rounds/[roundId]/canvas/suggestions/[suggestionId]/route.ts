import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { canvasConnections } from "@/db/schema";
import { jsonError, requireRouteClient } from "../../../../../_helpers";
import { requireOwnedRound } from "@/lib/data/ownership";
import { insertAuditLogEntry } from "@/lib/data/audit-log";
import type { CanvasEdge, ConnectionType } from "@/types/canvas";

/** POST /rounds/[roundId]/canvas/suggestions/[suggestionId] — accept an AI suggestion */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ roundId: string; suggestionId: string }> }
) {
  const { roundId, suggestionId } = await params;
  const client = await requireRouteClient();
  if ("response" in client) return client.response;

  try {
    await requireOwnedRound(roundId, client.userId);

    const existing = await db
      .select()
      .from(canvasConnections)
      .where(
        and(
          eq(canvasConnections.id, suggestionId),
          eq(canvasConnections.roundId, roundId),
          eq(canvasConnections.origin, "ai_suggested")
        )
      )
      .then((rows) => rows[0]);

    if (!existing) {
      return jsonError("Suggestion not found", 404);
    }

    const now = new Date();

    await db
      .update(canvasConnections)
      .set({ aiSuggestionAcceptedAt: now, updatedAt: now })
      .where(eq(canvasConnections.id, suggestionId));

    await insertAuditLogEntry({
      userId: client.userId,
      action: "accepted",
      entityType: "ai_suggestion",
      entityId: suggestionId,
      metadata: { suggestionId, connectionType: existing.connectionType },
    });

    const updated = await db
      .select()
      .from(canvasConnections)
      .where(eq(canvasConnections.id, suggestionId))
      .then((rows) => rows[0]!);

    const edge: CanvasEdge = {
      id: updated.id,
      source_node_id: updated.fromNodeId,
      target_node_id: updated.toNodeId,
      connection_type: updated.connectionType as ConnectionType,
      note: updated.notes,
      created_by: updated.createdBy,
      created_at: updated.createdAt.toISOString(),
      updated_at: updated.updatedAt.toISOString(),
    };

    return NextResponse.json(edge);
  } catch (error) {
    console.error("[rounds/canvas/suggestions/[suggestionId]/POST]", error);
    return jsonError(error instanceof Error ? error.message : "Failed to accept suggestion");
  }
}

/** DELETE /rounds/[roundId]/canvas/suggestions/[suggestionId] — reject an AI suggestion */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ roundId: string; suggestionId: string }> }
) {
  const { roundId, suggestionId } = await params;
  const client = await requireRouteClient();
  if ("response" in client) return client.response;

  try {
    await requireOwnedRound(roundId, client.userId);

    const existing = await db
      .select()
      .from(canvasConnections)
      .where(
        and(
          eq(canvasConnections.id, suggestionId),
          eq(canvasConnections.roundId, roundId),
          eq(canvasConnections.origin, "ai_suggested")
        )
      )
      .then((rows) => rows[0]);

    if (!existing) {
      return jsonError("Suggestion not found", 404);
    }

    await db
      .delete(canvasConnections)
      .where(eq(canvasConnections.id, suggestionId));

    await insertAuditLogEntry({
      userId: client.userId,
      action: "rejected",
      entityType: "ai_suggestion",
      entityId: suggestionId,
      metadata: { suggestionId, connectionType: existing.connectionType },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[rounds/canvas/suggestions/[suggestionId]/DELETE]", error);
    return jsonError(error instanceof Error ? error.message : "Failed to reject suggestion");
  }
}
