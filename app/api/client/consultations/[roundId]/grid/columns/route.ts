import { NextResponse } from "next/server";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { gridColumns } from "@/db/schema";
import { requireOwnedRound } from "@/lib/data/ownership";
import { jsonError, requireRouteClient } from "../../../../_helpers";
import { gridRouteErrorStatus } from "../_errors";

const createColumnSchema = z.object({
  question: z.string().trim().min(1).max(2000),
  position: z.number().int().nonnegative().optional(),
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

  const parsed = createColumnSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid payload", 422);
  }

  try {
    // Validate ownership
    await requireOwnedRound(roundId, client.userId);

    // Calculate position if not provided
    let position = parsed.data.position;
    if (position === undefined) {
      const [maxCol] = await db
        .select({ position: gridColumns.position })
        .from(gridColumns)
        .where(eq(gridColumns.consultationId, roundId))
        .orderBy(desc(gridColumns.position))
        .limit(1);
      position = maxCol ? maxCol.position + 1 : 0;
    }

    const [newCol] = await db
      .insert(gridColumns)
      .values({
        consultationId: roundId,
        userId: client.userId,
        question: parsed.data.question,
        position,
      })
      .returning();

    return NextResponse.json(newCol, { status: 201 });
  } catch (error) {
    console.error("[columns/POST] Failed to create column", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to create column",
      gridRouteErrorStatus(error)
    );
  }
}
