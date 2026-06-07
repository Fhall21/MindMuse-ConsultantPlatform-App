import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { gridCellInsights, gridCells, gridColumns, insights } from "@/db/schema";
import { requireOwnedMeeting } from "@/lib/data/ownership";
import { jsonError, requireRouteClient } from "../../../_helpers";
import type { GridReviewState } from "@/types/grid";

export interface MeetingGridInsight {
  id: string;
  label: string;
  editedLabel: string | null;
  gridReviewState: GridReviewState;
  accepted: boolean;
  rejected: boolean;
  gridCellId: string;
  gridColumnId: string;
  consultationId: string;
  question: string;
}

const STATE_PRIORITY: Record<string, number> = {
  accepted: 0,
  edited: 1,
  pending: 2,
  rejected: 3,
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!UUID_RE.test(id)) {
    return jsonError("Invalid meeting id", 400);
  }

  const client = await requireRouteClient();
  if ("response" in client) return client.response;

  try {
    await requireOwnedMeeting(id, client.userId);

    const rows = await db
      .select({
        insightId: insights.id,
        label: insights.label,
        editedLabel: gridCellInsights.editedLabel,
        gridReviewState: gridCellInsights.gridReviewState,
        accepted: gridCellInsights.accepted,
        rejected: gridCellInsights.rejected,
        gridCellId: gridCellInsights.gridCellId,
        gridColumnId: gridCellInsights.gridColumnId,
        consultationId: gridCells.consultationId,
        question: gridColumns.question,
      })
      .from(gridCellInsights)
      .innerJoin(insights, eq(insights.id, gridCellInsights.insightId))
      .innerJoin(gridCells, eq(gridCells.id, gridCellInsights.gridCellId))
      .innerJoin(gridColumns, eq(gridColumns.id, gridCellInsights.gridColumnId))
      .where(eq(gridCells.meetingId, id))
      .orderBy(asc(gridCellInsights.createdAt));

    // Dedup by insightId: accepted > edited > pending > rejected
    const best = new Map<string, typeof rows[number]>();
    for (const row of rows) {
      const prev = best.get(row.insightId);
      if (!prev) {
        best.set(row.insightId, row);
      } else {
        const prevP = STATE_PRIORITY[prev.gridReviewState ?? "pending"] ?? 99;
        const newP = STATE_PRIORITY[row.gridReviewState ?? "pending"] ?? 99;
        if (newP < prevP) best.set(row.insightId, row);
      }
    }

    const meetingInsights: MeetingGridInsight[] = Array.from(best.values()).map((row) => ({
      id: row.insightId,
      label: row.label,
      editedLabel: row.editedLabel,
      gridReviewState: (row.gridReviewState ?? "pending") as GridReviewState,
      accepted: row.accepted,
      rejected: row.rejected,
      gridCellId: row.gridCellId,
      gridColumnId: row.gridColumnId,
      consultationId: row.consultationId,
      question: row.question,
    }));

    return NextResponse.json({ insights: meetingInsights });
  } catch (error) {
    console.error("[meeting-grid-insights/GET]", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to fetch grid insights",
      500
    );
  }
}
