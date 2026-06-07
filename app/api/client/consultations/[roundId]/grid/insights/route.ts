import { NextResponse } from "next/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  gridCellInsights,
  gridCells,
  insights,
  gridColumns,
  meetings,
  quoteInsightLinks,
  quotes,
} from "@/db/schema";
import { requireOwnedRound } from "@/lib/data/ownership";
import { buildGridInsightsResponse } from "@/lib/quotes/grid-insight-response";
import { jsonError, requireRouteClient } from "../../../../_helpers";
import type { ConnectedColumnRow, QuoteLinkRow } from "../_types";
import { gridRouteErrorStatus } from "../_errors";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roundId: string }> }
) {
  const { roundId } = await params;
  const client = await requireRouteClient();
  if ("response" in client) return client.response;

  try {
    // Validate ownership of round
    await requireOwnedRound(roundId, client.userId);

    // Fetch all grid cell insights for this round
    const junctionRows = await db
      .select({
        id: insights.id,
        label: insights.label,
        description: insights.description,
        junctionId: gridCellInsights.id,
        editedLabel: gridCellInsights.editedLabel,
        gridReviewState: gridCellInsights.gridReviewState,
        accepted: gridCellInsights.accepted,
        rejected: gridCellInsights.rejected,
        gridCellId: gridCellInsights.gridCellId,
        gridColumnId: gridCellInsights.gridColumnId,
        createdAt: gridCellInsights.createdAt,
      })
      .from(gridCellInsights)
      .innerJoin(insights, eq(insights.id, gridCellInsights.insightId))
      .innerJoin(gridColumns, eq(gridColumns.id, gridCellInsights.gridColumnId))
      .where(eq(gridColumns.consultationId, roundId))
      .orderBy(asc(gridCellInsights.createdAt), asc(gridCellInsights.id));

    const insightIds = [...new Set(junctionRows.map((r) => r.id))];
    const meetingIds = [
      ...new Set(
        (
          await db
            .select({ meetingId: gridCells.meetingId })
            .from(gridCells)
            .innerJoin(
              gridCellInsights,
              eq(gridCellInsights.gridCellId, gridCells.id)
            )
            .innerJoin(gridColumns, eq(gridColumns.id, gridCellInsights.gridColumnId))
            .where(eq(gridColumns.consultationId, roundId))
        ).map((row) => row.meetingId)
      ),
    ];

    const meetingTranscripts = meetingIds.length
      ? await db
          .select({
            id: meetings.id,
            transcriptRaw: meetings.transcriptRaw,
          })
          .from(meetings)
          .where(inArray(meetings.id, meetingIds))
      : [];
    const transcriptByMeetingId = new Map(
      meetingTranscripts.map((meeting) => [meeting.id, meeting.transcriptRaw])
    );
    const cellMeetingRows = meetingIds.length
      ? await db
          .select({
            cellId: gridCells.id,
            meetingId: gridCells.meetingId,
          })
          .from(gridCells)
          .where(inArray(gridCells.meetingId, meetingIds))
      : [];
    const meetingIdByCellId = new Map(
      cellMeetingRows.map((row) => [row.cellId, row.meetingId])
    );

    // Batch query for connectedColumns (avoid N+1)
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
            eq(gridColumns.consultationId, roundId)
          )
        );
    }

    // Batch query for quoteInsightLinks (avoid N+1)
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
        })
        .from(quoteInsightLinks)
        .innerJoin(quotes, eq(quotes.id, quoteInsightLinks.quoteId))
        .where(inArray(quoteInsightLinks.insightId, insightIds));
    }

    const insightsWithLinks = junctionRows.map((row) => {
      const meetingId = meetingIdByCellId.get(row.gridCellId);
      const transcriptRaw = meetingId
        ? (transcriptByMeetingId.get(meetingId) ?? null)
        : null;

      return buildGridInsightsResponse(
        [row],
        connectedCols,
        quotesList,
        transcriptRaw
      )[0];
    });

    return NextResponse.json({ insights: insightsWithLinks });
  } catch (error) {
    console.error("[round-insights/GET] Failed to fetch round insights", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to fetch round insights",
      gridRouteErrorStatus(error)
    );
  }
}
