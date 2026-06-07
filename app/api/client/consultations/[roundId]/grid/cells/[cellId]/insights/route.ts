import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { gridCells, gridCellInsights, insights, gridColumns, quoteInsightLinks, quotes } from "@/db/schema";
import { requireOwnedRound } from "@/lib/data/ownership";
import { jsonError, requireRouteClient } from "../../../../../../_helpers";
import type { ConnectedColumnRow, QuoteLinkRow } from "../../../_types";
import { gridRouteErrorStatus } from "../../../_errors";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roundId: string; cellId: string }> }
) {
  const { roundId, cellId } = await params;
  const client = await requireRouteClient();
  if ("response" in client) return client.response;

  try {
    // Validate ownership of round
    await requireOwnedRound(roundId, client.userId);

    // Verify cell belongs to this round
    const [cell] = await db
      .select()
      .from(gridCells)
      .where(
        and(
          eq(gridCells.id, cellId),
          eq(gridCells.consultationId, roundId)
        )
      )
      .limit(1);

    if (!cell) {
      return jsonError("Cell not found", 404);
    }

    // Fetch cell insights
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
      .where(eq(gridCellInsights.gridCellId, cellId));

    const insightIds = junctionRows.map((r) => r.id);

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
    console.error("[cell-insights/GET] Failed to fetch cell insights", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to fetch cell insights",
      gridRouteErrorStatus(error)
    );
  }
}
