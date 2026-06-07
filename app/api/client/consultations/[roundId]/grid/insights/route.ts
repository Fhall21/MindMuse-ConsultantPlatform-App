import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { gridCellInsights, insights, gridColumns, quoteInsightLinks, quotes } from "@/db/schema";
import { requireOwnedRound } from "@/lib/data/ownership";
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
      })
      .from(gridCellInsights)
      .innerJoin(insights, eq(insights.id, gridCellInsights.insightId))
      .innerJoin(gridColumns, eq(gridColumns.id, gridCellInsights.gridColumnId))
      .where(eq(gridColumns.consultationId, roundId));

    const insightIds = [...new Set(junctionRows.map((r) => r.id))];

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
        })
        .from(quoteInsightLinks)
        .innerJoin(quotes, eq(quotes.id, quoteInsightLinks.quoteId))
        .where(inArray(quoteInsightLinks.insightId, insightIds));
    }

    // Map connected columns and quotes back to each insight
    const insightsWithLinks = junctionRows.map((row) => {
      const rowConnectedCols = connectedCols
        .filter((col) => col.insightId === row.id)
        .map((col) => ({
          columnId: col.columnId,
          question: col.question,
          gridReviewState: col.gridReviewState ?? "pending",
          accepted: col.accepted,
        }));

      const rowQuotes = quotesList
        .filter((q) => q.insightId === row.id)
        .map((q) => ({
          id: q.id,
          exactText: q.exactText,
          speakerLabel: q.speakerLabel,
          spanStart: q.spanStart,
          spanEnd: q.spanEnd,
          relevanceStrength: q.relevanceStrength,
        }));

      return {
        ...row,
        gridReviewState: row.gridReviewState ?? "pending",
        connectedColumns: rowConnectedCols,
        quotes: rowQuotes,
      };
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
