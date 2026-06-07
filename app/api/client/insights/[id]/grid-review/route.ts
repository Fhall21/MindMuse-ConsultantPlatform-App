import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  insights,
  gridCells,
  gridColumns,
  gridCellInsights,
  auditLog,
  meetings,
  quotes,
  quoteInsightLinks,
} from "@/db/schema";
import { jsonError, requireRouteClient } from "../../../_helpers";

const patchReviewSchema = z.object({
  cellId: z.string().uuid(),
  gridReviewState: z.enum(["pending", "accepted", "rejected", "edited"]),
  editedText: z.string().trim().min(1).max(2000).optional(),
  editScope: z.enum(["cell", "all"]).optional().default("cell"),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const client = await requireRouteClient();
  if ("response" in client) return client.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON", 422);
  }

  const parsed = patchReviewSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid payload", 422);
  }

  const { cellId, gridReviewState, editedText, editScope } = parsed.data;

  try {
    const [insightRow] = await db
      .select({
        id: insights.id,
        meetingId: insights.meetingId,
        label: insights.label,
        consultationId: meetings.consultationId,
      })
      .from(insights)
      .innerJoin(
        meetings,
        and(
          eq(meetings.id, insights.meetingId),
          eq(meetings.userId, client.userId)
        )
      )
      .where(eq(insights.id, id))
      .limit(1);

    if (!insightRow) {
      return jsonError("Insight not found", 404);
    }

    if (!insightRow.meetingId) {
      return jsonError("Insight has no associated meeting", 400);
    }

    // Verify cell exists and belongs to the consultation round
    const [cell] = await db
      .select()
      .from(gridCells)
      .where(eq(gridCells.id, cellId))
      .limit(1);

    if (!cell) {
      return jsonError("Cell not found", 404);
    }

    if (cell.consultationId !== insightRow.consultationId) {
      return jsonError("Cell does not belong to this consultation", 403);
    }

    // Look up junction row
    const [junction] = await db
      .select()
      .from(gridCellInsights)
      .where(
        and(
          eq(gridCellInsights.insightId, id),
          eq(gridCellInsights.gridCellId, cellId)
        )
      )
      .limit(1);

    if (!junction) {
      return jsonError("Junction row not found", 404);
    }

    // App-layer assertion
    if (junction.gridColumnId !== cell.columnId) {
      return jsonError("Junction gridColumnId mismatch", 400);
    }

    // Wrap state update, global aggregation sync and audit logs in transaction
    await db.transaction(async (tx) => {
      // a. Label edit logic
      if (editedText !== undefined) {
        if (editScope === "cell") {
          await tx
            .update(gridCellInsights)
            .set({
              editedLabel: editedText,
              gridReviewState: "edited",
              updatedAt: new Date(),
            })
            .where(eq(gridCellInsights.id, junction.id));

          await tx.insert(auditLog).values({
            meetingId: insightRow.meetingId,
            action: "grid_insight_label_edited_cell",
            entityType: "insight",
            entityId: id,
            payload: {
              junctionId: junction.id,
              cellId,
              originalLabel: insightRow.label,
              editedLabel: editedText,
            },
            userId: client.userId,
          });
        } else if (editScope === "all") {
          await tx
            .update(insights)
            .set({ label: editedText })
            .where(eq(insights.id, id));

          await tx.insert(auditLog).values({
            meetingId: insightRow.meetingId,
            action: "grid_insight_label_edited_global",
            entityType: "insight",
            entityId: id,
            payload: {
              originalLabel: insightRow.label,
              newLabel: editedText,
            },
            userId: client.userId,
          });
        }
      }

      // b. Junction state update
      let newState = gridReviewState;
      if (editedText !== undefined && editScope === "cell") {
        newState = "edited";
      }

      const acceptedVal = newState === "accepted";
      const rejectedVal = newState === "rejected";

      await tx
        .update(gridCellInsights)
        .set({
          gridReviewState: newState,
          accepted: acceptedVal,
          rejected: rejectedVal,
          updatedAt: new Date(),
        })
        .where(eq(gridCellInsights.id, junction.id));

      // c. Sync global flags on insights table
      const allJunctions = await tx
        .select()
        .from(gridCellInsights)
        .where(eq(gridCellInsights.insightId, id));

      const hasAnyAccepted = allJunctions.some((j) => j.accepted);
      const areAllRejected = allJunctions.length > 0 && allJunctions.every((j) => j.rejected);

      await tx
        .update(insights)
        .set({
          accepted: hasAnyAccepted,
          rejected: areAllRejected,
          rejectedAt: areAllRejected ? new Date() : null,
        })
        .where(eq(insights.id, id));

      // d. Write audit log for state change (avoid double log)
      if (editedText === undefined) {
        await tx.insert(auditLog).values({
          meetingId: insightRow.meetingId,
          action: `grid_insight_${newState}`,
          entityType: "insight",
          entityId: id,
          payload: {
            junctionId: junction.id,
            cellId,
            columnId: junction.gridColumnId,
          },
          userId: client.userId,
        });
      }
    });

    // Fetch updated junction row joined with insight
    const [updatedJunction] = await db
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
      .where(eq(gridCellInsights.id, junction.id))
      .limit(1);

    const connectedCols = await db
      .select({
        columnId: gridCellInsights.gridColumnId,
        question: gridColumns.question,
        gridReviewState: gridCellInsights.gridReviewState,
        accepted: gridCellInsights.accepted,
      })
      .from(gridCellInsights)
      .innerJoin(gridColumns, eq(gridColumns.id, gridCellInsights.gridColumnId))
      .where(
        and(
          eq(gridCellInsights.insightId, id),
          eq(gridColumns.consultationId, insightRow.consultationId)
        )
      );

    const quotesList = await db
      .select({
        id: quotes.id,
        exactText: quotes.exactText,
        speakerLabel: quotes.speakerLabel,
        spanStart: quotes.spanStart,
        spanEnd: quotes.spanEnd,
        relevanceStrength: quoteInsightLinks.relevanceStrength,
      })
      .from(quoteInsightLinks)
      .innerJoin(quotes, eq(quotes.id, quoteInsightLinks.quoteId))
      .where(eq(quoteInsightLinks.insightId, id));

    return NextResponse.json({
      ...updatedJunction,
      gridReviewState: updatedJunction.gridReviewState ?? "pending",
      connectedColumns: connectedCols.map((column) => ({
        ...column,
        gridReviewState: column.gridReviewState ?? "pending",
      })),
      quotes: quotesList,
    });
  } catch (error) {
    console.error("[grid-review/PATCH] Failed to update review", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to update review",
      500
    );
  }
}
