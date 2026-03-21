import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { canvasConnections } from "@/db/schema";
import { jsonError, requireRouteClient } from "../../../../_helpers";
import { requireOwnedMeeting } from "@/lib/data/ownership";
import type { AiConnectionSuggestion } from "@/types/canvas";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: consultationId } = await params;
  const client = await requireRouteClient();
  if ("response" in client) return client.response;

  try {
    const meeting = await requireOwnedMeeting(consultationId, client.userId);
    const consultationGroupId = meeting.consultationId;
    if (!consultationGroupId) return jsonError("Meeting has no active consultation", 400);

    const rows = await db
      .select()
      .from(canvasConnections)
      .where(
        and(
          eq(canvasConnections.consultationId, consultationGroupId),
          eq(canvasConnections.origin, "ai_suggested"),
          isNull(canvasConnections.aiSuggestionAcceptedAt)
        )
      );

    const suggestions: AiConnectionSuggestion[] = rows.map((row) => ({
      id: row.id,
      consultation_id: consultationId,
      source_node_id: row.fromNodeId,
      target_node_id: row.toNodeId,
      suggested_connection_type: row.connectionType as AiConnectionSuggestion["suggested_connection_type"],
      rationale: row.aiSuggestionRationale ?? "",
      status: "pending",
      reviewed_by: null,
      reviewed_at: null,
      created_at: row.createdAt.toISOString(),
    }));

    return NextResponse.json(suggestions);
  } catch (error) {
    console.error("[canvas/suggestions/GET]", error);
    return jsonError(error instanceof Error ? error.message : "Failed to load suggestions");
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: consultationId } = await params;
  const client = await requireRouteClient();
  if ("response" in client) return client.response;

  try {
    await requireOwnedMeeting(consultationId, client.userId);

    return NextResponse.json(
      { message: "AI suggestion generation not yet implemented" },
      { status: 202 }
    );
  } catch (error) {
    console.error("[canvas/suggestions/POST]", error);
    return jsonError(error instanceof Error ? error.message : "Failed to trigger suggestion generation");
  }
}
