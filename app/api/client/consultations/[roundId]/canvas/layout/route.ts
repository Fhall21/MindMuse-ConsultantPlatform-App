import { NextResponse } from "next/server";
import { saveCanvasLayout } from "@/lib/data/canvas";
import { jsonError, requireRouteClient } from "../../../../_helpers";
import { requireOwnedRound } from "@/lib/data/ownership";
import type { CanvasLayoutPosition, CanvasViewport } from "@/types/canvas";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roundId: string }> }
) {
  const { roundId } = await params;
  const client = await requireRouteClient();
  if ("response" in client) return client.response;

  try {
    await requireOwnedRound(roundId, client.userId);

    const body = await request.json();
    const { positions, viewport } = body;

    if (
      !positions ||
      typeof positions !== "object" ||
      !viewport ||
      typeof viewport.x !== "number" ||
      typeof viewport.y !== "number" ||
      typeof viewport.zoom !== "number"
    ) {
      return jsonError("Invalid layout data", 400);
    }

    await saveCanvasLayout(roundId, client.userId, {
      positions: positions as Record<string, CanvasLayoutPosition>,
      viewport: viewport as CanvasViewport,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[rounds/canvas/layout/POST]", error);
    return jsonError(error instanceof Error ? error.message : "Failed to save layout");
  }
}
