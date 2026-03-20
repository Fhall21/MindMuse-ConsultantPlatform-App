import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { consultations, consultationRounds, insights, themes } from "@/db/schema";
import { loadCanvasConnections, loadCanvasLayout } from "@/lib/data/canvas";
import { jsonError, requireRouteClient } from "../../../_helpers";
import { requireOwnedConsultation } from "@/lib/data/ownership";
import type { CanvasNode } from "@/types/canvas";

export async function GET(
  _request: Request,
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

    // Get the consultation's current round
    const consultation = await db
      .select()
      .from(consultations)
      .where(eq(consultations.id, consultationId))
      .then((rows) => rows[0]);

    if (!consultation) {
      return jsonError("Consultation not found", 404);
    }

    const roundId = consultation.roundId;
    if (!roundId) {
      return jsonError("Consultation has no active round", 400);
    }

    // Load themes (for canvas nodes)
    const themeRows = await db
      .select()
      .from(themes)
      .where(eq(themes.roundId, roundId));

    const themeNodes: CanvasNode[] = themeRows.map((theme) => ({
      id: theme.id,
      type: "theme",
      label: theme.label,
      description: theme.description,
      accepted: theme.status === "accepted",
      subgroup: null, // TODO: add to themes table if needed
      position: { x: 0, y: 0 }, // Will be loaded from layout state
    }));

    // Load insights (for canvas nodes)
    const insightRows = await db
      .select()
      .from(insights)
      .where(eq(insights.consultationId, consultationId));

    const insightNodes: CanvasNode[] = insightRows.map((insight) => ({
      id: insight.id,
      type: "insight",
      label: insight.label,
      description: insight.description,
      accepted: insight.accepted,
      subgroup: null, // TODO: add to insights table if needed
      position: { x: 0, y: 0 }, // Will be loaded from layout state
    }));

    // Load connections and layout
    const [edges, layout] = await Promise.all([
      loadCanvasConnections(roundId, client.userId),
      loadCanvasLayout(roundId, client.userId),
    ]);

    // Apply saved positions to nodes
    const allNodes = [...themeNodes, ...insightNodes];
    for (const node of allNodes) {
      if (layout.positions[node.id]) {
        node.position = layout.positions[node.id];
      }
    }

    return NextResponse.json({
      consultation_id: consultationId,
      round_id: roundId,
      nodes: allNodes,
      edges,
      viewport: layout.viewport,
    });
  } catch (error) {
    console.error("[canvas/GET]", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to load canvas"
    );
  }
}
