import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { gridColumns, gridCells } from "@/db/schema";
import { requireOwnedRound } from "@/lib/data/ownership";
import { jsonError, requireRouteClient } from "../../../_helpers";
import { gridRouteErrorStatus } from "./_errors";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roundId: string }> }
) {
  const { roundId } = await params;
  const client = await requireRouteClient();
  if ("response" in client) return client.response;

  try {
    // Validate ownership
    await requireOwnedRound(roundId, client.userId);

    // Fetch columns ordered by position
    const cols = await db
      .select()
      .from(gridColumns)
      .where(eq(gridColumns.consultationId, roundId))
      .orderBy(gridColumns.position);

    // Fetch cells for the round
    const cells = await db
      .select()
      .from(gridCells)
      .where(eq(gridCells.consultationId, roundId));

    return NextResponse.json({
      columns: cols,
      cells: cells.map((cell) => ({
        ...cell,
        status: cell.status ?? "pending",
      })),
    });
  } catch (error) {
    console.error("[grid/GET] Failed to fetch grid data", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to fetch grid data",
      gridRouteErrorStatus(error)
    );
  }
}
