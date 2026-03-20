import { NextResponse } from "next/server";
import { saveCanvasLayout } from "@/lib/data/canvas";
import { jsonError, requireRouteClient } from "../../../../_helpers";
import { requireOwnedConsultation } from "@/lib/data/ownership";
import type { CanvasViewport } from "@/types/canvas";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: consultationId } = await params;
  const client = await requireRouteClient();
  if ("response" in client) return client.response;

  try {
    const consultation = await requireOwnedConsultation(consultationId, client.userId);
    if (!consultation.roundId) return jsonError("Consultation has no active round", 400);

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

    await saveCanvasLayout(consultation.roundId, client.userId, {
      positions: positions as Record<string, { nodeType: string; x: number; y: number }>,
      viewport: viewport as CanvasViewport,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[canvas/layout/POST]", error);
    return jsonError(error instanceof Error ? error.message : "Failed to save layout");
  }
}
