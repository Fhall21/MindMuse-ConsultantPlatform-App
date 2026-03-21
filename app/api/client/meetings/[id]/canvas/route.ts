import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { consultations, insights, themeMembers, themes } from "@/db/schema";
import { loadCanvasConnections, loadCanvasLayout } from "@/lib/data/canvas";
import { jsonError, requireRouteClient } from "../../../_helpers";
import { requireOwnedConsultation } from "@/lib/data/ownership";
import type { CanvasNode } from "@/types/canvas";

function buildFallbackPositions(nodes: CanvasNode[]) {
  const insightColumns = new Map<string, CanvasNode[]>();
  const themeNodes: CanvasNode[] = [];

  for (const node of nodes) {
    if (node.type === "insight" && node.sourceConsultationId) {
      const bucket = insightColumns.get(node.sourceConsultationId) ?? [];
      bucket.push(node);
      insightColumns.set(node.sourceConsultationId, bucket);
      continue;
    }

    themeNodes.push(node);
  }

  let consultationColumn = 0;
  for (const bucket of insightColumns.values()) {
    bucket.sort((a, b) => a.label.localeCompare(b.label));
    bucket.forEach((node, index) => {
      node.position = {
        x: 48 + consultationColumn * 288,
        y: 72 + index * 168,
      };
    });
    consultationColumn += 1;
  }

  const themeStartX = Math.max(consultationColumn * 288 + 176, 688);
  themeNodes
    .sort((a, b) => a.label.localeCompare(b.label))
    .forEach((node, index) => {
      node.position = {
        x: themeStartX + Math.floor(index / 6) * 280,
        y: 72 + (index % 6) * 148,
      };
    });
}

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

    const themeRows = await db
      .select()
      .from(themes)
      .where(
        and(eq(themes.roundId, roundId), eq(themes.userId, client.userId))
      );

    const memberRows = await db
      .select()
      .from(themeMembers)
      .where(
        and(
          eq(themeMembers.roundId, roundId),
          eq(themeMembers.userId, client.userId)
        )
      )
      .orderBy(asc(themeMembers.position), asc(themeMembers.createdAt));

    const memberIdsByGroup = new Map<string, string[]>();
    const groupIdByInsight = new Map<string, string>();
    for (const member of memberRows) {
      const memberIds = memberIdsByGroup.get(member.themeId) ?? [];
      memberIds.push(member.insightId);
      memberIdsByGroup.set(member.themeId, memberIds);
      groupIdByInsight.set(member.insightId, member.themeId);
    }

    const themeNodes: CanvasNode[] = themeRows.map((theme) => ({
      id: theme.id,
      type: "theme",
      label: theme.label,
      description: theme.description,
      accepted: theme.status === "accepted",
      subgroup: null,
      sourceConsultationId: null,
      sourceConsultationTitle: null,
      groupId: null,
      memberIds: memberIdsByGroup.get(theme.id) ?? [],
      isUserAdded: false,
      lockedFromSource: false,
      position: { x: 0, y: 0 },
    }));

    const insightRows = await db
      .select({
        insight: insights,
        consultationTitle: consultations.title,
      })
      .from(insights)
      .innerJoin(consultations, eq(insights.consultationId, consultations.id))
      .where(
        and(
          eq(consultations.roundId, roundId),
          eq(consultations.userId, client.userId)
        )
      )
      .orderBy(asc(consultations.createdAt), asc(insights.createdAt));

    const insightNodes: CanvasNode[] = insightRows.map(({ insight, consultationTitle }) => ({
      id: insight.id,
      type: "insight",
      label: insight.label,
      description: insight.description,
      accepted: insight.accepted,
      subgroup: null,
      sourceConsultationId: insight.consultationId,
      sourceConsultationTitle: consultationTitle,
      groupId: groupIdByInsight.get(insight.id) ?? null,
      memberIds: [],
      isUserAdded: insight.isUserAdded,
      lockedFromSource: Boolean(groupIdByInsight.get(insight.id)),
      position: { x: 0, y: 0 },
    }));

    // Load connections and layout
    const [edges, layout] = await Promise.all([
      loadCanvasConnections(roundId, client.userId),
      loadCanvasLayout(roundId, client.userId),
    ]);

    // Apply saved positions to nodes
    const allNodes = [...insightNodes, ...themeNodes];
    buildFallbackPositions(allNodes);
    for (const node of allNodes) {
      if (layout.positions[node.id]) {
        node.position = layout.positions[node.id];
      }
    }

    const insightPositions = new Map(
      allNodes
        .filter((node) => node.type === "insight")
        .map((node) => [node.id, node.position] as const)
    );

    for (const node of allNodes) {
      if (node.type !== "theme" || layout.positions[node.id] || node.memberIds.length === 0) {
        continue;
      }

      const memberPositions = node.memberIds
        .map((memberId) => insightPositions.get(memberId))
        .filter((position): position is NonNullable<typeof position> => Boolean(position));

      if (memberPositions.length === 0) {
        continue;
      }

      const averageX =
        memberPositions.reduce((sum, position) => sum + position.x, 0) /
        memberPositions.length;
      const averageY =
        memberPositions.reduce((sum, position) => sum + position.y, 0) /
        memberPositions.length;

      node.position = {
        x: averageX + 220,
        y: averageY - 24,
      };
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
