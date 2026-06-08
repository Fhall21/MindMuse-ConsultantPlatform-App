import { NextResponse } from "next/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  gridCellInsights,
  gridCells,
  gridColumns,
  insights,
  meetings,
  quoteInsightLinks,
  quotes,
} from "@/db/schema";
import { requireOwnedMeeting } from "@/lib/data/ownership";
import { buildGridInsightsResponse } from "@/lib/quotes/grid-insight-response";
import { jsonError, requireRouteClient } from "../../../_helpers";
import type { ConnectedColumnRow, QuoteLinkRow } from "../../../consultations/[roundId]/grid/_types";
import type { GridReviewState, InsightWithLinks } from "@/types/grid";

export interface MeetingGridInsight extends InsightWithLinks {
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
        junctionId: gridCellInsights.id,
        label: insights.label,
        description: insights.description,
        editedLabel: gridCellInsights.editedLabel,
        gridReviewState: gridCellInsights.gridReviewState,
        accepted: gridCellInsights.accepted,
        rejected: gridCellInsights.rejected,
        gridCellId: gridCellInsights.gridCellId,
        gridColumnId: gridCellInsights.gridColumnId,
        createdAt: gridCellInsights.createdAt,
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

    const selectedRows = Array.from(best.values());
    const insightIds = selectedRows.map((row) => row.insightId);

    let connectedCols: ConnectedColumnRow[] = [];
    if (insightIds.length > 0) {
      connectedCols = await db
        .select({
          insightId: gridCellInsights.insightId,
          columnId: gridCellInsights.gridColumnId,
          question: gridColumns.question,
          gridReviewState: gridCellInsights.gridReviewState,
          accepted: gridCellInsights.accepted,
        })
        .from(gridCellInsights)
        .innerJoin(gridColumns, eq(gridColumns.id, gridCellInsights.gridColumnId))
        .where(
          and(
            inArray(gridCellInsights.insightId, insightIds),
            inArray(
              gridColumns.consultationId,
              [...new Set(selectedRows.map((row) => row.consultationId))]
            )
          )
        );
    }

    let quotesList: QuoteLinkRow[] = [];
    if (insightIds.length > 0) {
      quotesList = await db
        .select({
          insightId: quoteInsightLinks.insightId,
          id: quotes.id,
          exactText: quotes.exactText,
          speakerLabel: quotes.speakerLabel,
          spanStart: quotes.spanStart,
          spanEnd: quotes.spanEnd,
          relevanceStrength: quoteInsightLinks.relevanceStrength,
          contextBefore: quotes.contextBefore,
          contextAfter: quotes.contextAfter,
          transcriptRaw: meetings.transcriptRaw,
        })
        .from(quoteInsightLinks)
        .innerJoin(quotes, eq(quotes.id, quoteInsightLinks.quoteId))
        .innerJoin(meetings, eq(meetings.id, quotes.meetingId))
        .where(inArray(quoteInsightLinks.insightId, insightIds));
    }

    const metadataByInsightId = new Map(
      selectedRows.map((row) => [
        row.insightId,
        { consultationId: row.consultationId, question: row.question },
      ])
    );

    const meetingInsights: MeetingGridInsight[] = buildGridInsightsResponse(
      selectedRows.map((row) => ({
        id: row.insightId,
        label: row.label,
        description: row.description,
        junctionId: row.junctionId,
        editedLabel: row.editedLabel,
        gridReviewState: (row.gridReviewState ?? "pending") as GridReviewState,
        accepted: row.accepted,
        rejected: row.rejected,
        gridCellId: row.gridCellId,
        gridColumnId: row.gridColumnId,
        createdAt: row.createdAt,
      })),
      connectedCols,
      quotesList,
      null
    ).map((insight) => ({
      ...insight,
      consultationId: metadataByInsightId.get(insight.id)?.consultationId ?? "",
      question: metadataByInsightId.get(insight.id)?.question ?? "",
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
