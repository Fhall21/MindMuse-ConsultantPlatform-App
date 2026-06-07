import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { gridCells } from "@/db/schema";
import { requireOwnedRound } from "@/lib/data/ownership";
import { jsonError, requireRouteClient } from "../../../../_helpers";
import { gridRouteErrorStatus } from "../_errors";

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

    const cells = await db
      .select()
      .from(gridCells)
      .where(eq(gridCells.consultationId, roundId));

    return NextResponse.json({
      cells: cells.map((cell) => ({
        ...cell,
        status: cell.status ?? "pending",
      })),
    });
  } catch (error) {
    console.error("[cells/GET] Failed to fetch cells", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to fetch cells",
      gridRouteErrorStatus(error)
    );
  }
}
