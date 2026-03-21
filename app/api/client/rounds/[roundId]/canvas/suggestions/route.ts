import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { canvasConnections } from "@/db/schema";
import { jsonError, requireRouteClient } from "../../../../_helpers";
import { requireOwnedRound } from "@/lib/data/ownership";
import type { AiConnectionSuggestion } from "@/types/canvas";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roundId: string }> }
) {
  const { roundId } = await params;
  const client = await requireRouteClient();
  if ("response" in client) return client.response;

  try {
    await requireOwnedRound(roundId, client.userId);

    const rows = await db
      .select()
      .from(canvasConnections)
      .where(
        and(
          eq(canvasConnections.roundId, roundId),
          eq(canvasConnections.origin, "ai_suggested"),
          isNull(canvasConnections.aiSuggestionAcceptedAt)
        )
      );

    const suggestions: AiConnectionSuggestion[] = rows.map((row) => ({
      id: row.id,
      consultation_id: roundId,
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
    console.error("[rounds/canvas/suggestions/GET]", error);
    return jsonError(error instanceof Error ? error.message : "Failed to load suggestions");
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ roundId: string }> }
) {
  const { roundId } = await params;
  const client = await requireRouteClient();
  if ("response" in client) return client.response;

  try {
    await requireOwnedRound(roundId, client.userId);

    return NextResponse.json(
      { message: "AI suggestion generation not yet implemented" },
      { status: 202 }
    );
  } catch (error) {
    console.error("[rounds/canvas/suggestions/POST]", error);
    return jsonError(error instanceof Error ? error.message : "Failed to trigger suggestion generation");
  }
}
