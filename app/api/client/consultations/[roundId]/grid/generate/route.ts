import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { gridColumns, gridCells, meetings } from "@/db/schema";
import { requireOwnedRound } from "@/lib/data/ownership";
import { jsonError, requireRouteClient } from "../../../../_helpers";
import { gridRouteErrorStatus } from "../_errors";

const generateSchema = z.object({
  columnId: z.string().uuid(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roundId: string }> }
) {
  const { roundId } = await params;
  const client = await requireRouteClient();
  if ("response" in client) return client.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON", 422);
  }

  const parsed = generateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid payload", 422);
  }

  try {
    // Validate ownership
    await requireOwnedRound(roundId, client.userId);

    // Verify column ownership and round association
    const [column] = await db
      .select()
      .from(gridColumns)
      .where(
        and(
          eq(gridColumns.id, parsed.data.columnId),
          eq(gridColumns.consultationId, roundId),
          eq(gridColumns.userId, client.userId)
        )
      )
      .limit(1);

    if (!column) {
      return jsonError("Column not found", 404);
    }

    // Get all meetings in the round
    const meetingsInRound = await db
      .select({ id: meetings.id })
      .from(meetings)
      .where(
        and(
          eq(meetings.consultationId, roundId),
          eq(meetings.userId, client.userId)
        )
      );

    const meetingIds = meetingsInRound.map((m) => m.id);

    await db.transaction(async (tx) => {
      for (const meetingId of meetingIds) {
        await tx
          .insert(gridCells)
          .values({
            consultationId: roundId,
            meetingId,
            columnId: column.id,
            status: "pending",
            confidence: null,
            quoteCount: 0,
            insightCount: 0,
          })
          .onConflictDoUpdate({
            target: [gridCells.meetingId, gridCells.columnId],
            set: {
              status: "pending",
              confidence: null,
              updatedAt: new Date(),
            },
          });
      }
    });

    return NextResponse.json({ meetingIds });
  } catch (error) {
    console.error("[generate/POST] Failed to initialize grid cells", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to initialize grid cells",
      gridRouteErrorStatus(error)
    );
  }
}
