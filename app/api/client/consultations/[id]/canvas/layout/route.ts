import { NextResponse } from "next/server";
import { saveCanvasLayout } from "@/lib/data/canvas";
import { jsonError, requireRouteClient } from "../../../../_helpers";
import { requireOwnedConsultation } from "@/lib/data/ownership";
import type { CanvasPosition, CanvasViewport } from "@/types/canvas";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: consultationId } = await params;
  const client = await requireRouteClient();

  if ("response" in client) {
    return client.response;
  }

  try {
    // Verify consultation ownership
    await requireOwnedConsultation(consultationId, client.userId);

    // TODO: Get roundId from consultation
    const roundId = ""; // Will be fetched from consultation

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
      positions: positions as Record<string, CanvasPosition>,
      viewport: viewport as CanvasViewport,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[layout/POST]", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to save layout"
    );
  }
}
