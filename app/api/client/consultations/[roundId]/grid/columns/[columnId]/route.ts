import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { gridColumns } from "@/db/schema";
import { requireOwnedRound } from "@/lib/data/ownership";
import { jsonError, requireRouteClient } from "../../../../../_helpers";
import { gridRouteErrorStatus } from "../../_errors";

const patchColumnSchema = z
  .object({
    question: z.string().trim().min(1).max(2000).optional(),
    position: z.number().int().nonnegative().optional(),
  })
  .refine(
    (value) => value.question !== undefined || value.position !== undefined,
    "At least one column field is required"
  );

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ roundId: string; columnId: string }> }
) {
  const { roundId, columnId } = await params;
  const client = await requireRouteClient();
  if ("response" in client) return client.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON", 422);
  }

  const parsed = patchColumnSchema.safeParse(body);
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
          eq(gridColumns.id, columnId),
          eq(gridColumns.consultationId, roundId),
          eq(gridColumns.userId, client.userId)
        )
      )
      .limit(1);

    if (!column) {
      return jsonError("Column not found", 404);
    }

    const updates: { question?: string; position?: number; updatedAt: Date } = {
      updatedAt: new Date(),
    };
    if (parsed.data.question !== undefined) updates.question = parsed.data.question;
    if (parsed.data.position !== undefined) updates.position = parsed.data.position;

    const [updatedCol] = await db
      .update(gridColumns)
      .set(updates)
      .where(eq(gridColumns.id, columnId))
      .returning();

    return NextResponse.json(updatedCol);
  } catch (error) {
    console.error("[columns/PATCH] Failed to update column", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to update column",
      gridRouteErrorStatus(error)
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ roundId: string; columnId: string }> }
) {
  const { roundId, columnId } = await params;
  const client = await requireRouteClient();
  if ("response" in client) return client.response;

  try {
    // Validate ownership
    await requireOwnedRound(roundId, client.userId);

    // Verify column ownership and round association
    const [column] = await db
      .select()
      .from(gridColumns)
      .where(
        and(
          eq(gridColumns.id, columnId),
          eq(gridColumns.consultationId, roundId),
          eq(gridColumns.userId, client.userId)
        )
      )
      .limit(1);

    if (!column) {
      return jsonError("Column not found", 404);
    }

    // Delete column (cascade to cells/junctions handled by DB)
    await db
      .delete(gridColumns)
      .where(eq(gridColumns.id, columnId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[columns/DELETE] Failed to delete column", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to delete column",
      gridRouteErrorStatus(error)
    );
  }
}
