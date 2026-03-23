import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { meetings, insights, themeMembers, themes } from "@/db/schema";
import { loadCanvasConnections, loadCanvasLayout } from "@/lib/data/canvas";
import { jsonError, requireRouteClient } from "../../../_helpers";
import { requireOwnedRound } from "@/lib/data/ownership";
import type { CanvasNode } from "@/types/canvas";

const GROUP_COLUMNS = 2;
const GROUP_WIDTH = 596;
const GROUP_HEADER_HEIGHT = 118;
const GROUP_PADDING_X = 28;
const GROUP_PADDING_TOP = 24;
const GROUP_PADDING_BOTTOM = 28;
const GROUP_GAP_X = 24;
const GROUP_GAP_Y = 22;
const INSIGHT_WIDTH = 258;
const INSIGHT_HEIGHT = 110;
const THEME_GRID_GAP_X = 56;
const THEME_GRID_GAP_Y = 72;

function getGroupHeight(memberCount: number) {
  const visibleCount = Math.max(memberCount, 1);
  const rowCount = Math.max(1, Math.ceil(visibleCount / GROUP_COLUMNS));

  return Math.max(
    246,
    GROUP_HEADER_HEIGHT +
      GROUP_PADDING_TOP +
      GROUP_PADDING_BOTTOM +
      rowCount * INSIGHT_HEIGHT +
      Math.max(0, rowCount - 1) * GROUP_GAP_Y
  );
}

function getDefaultGroupedPosition(index: number) {
  const row = Math.floor(index / GROUP_COLUMNS);
  const column = index % GROUP_COLUMNS;

  return {
    x: GROUP_PADDING_X + column * (INSIGHT_WIDTH + GROUP_GAP_X),
    y: GROUP_HEADER_HEIGHT + GROUP_PADDING_TOP + row * (INSIGHT_HEIGHT + GROUP_GAP_Y),
  };
}

function seedThemeGroupGrid(nodes: CanvasNode[]) {
  const nodesById = new Map(nodes.map((node) => [node.id, node] as const));
  const themeNodes = nodes
    .filter((node) => node.type === "theme" && node.memberIds.length > 0)
    .sort((left, right) => left.label.localeCompare(right.label));

  if (themeNodes.length === 0) {
    return false;
  }

  const leftMostThemeX = Math.min(...themeNodes.map((node) => node.position.x));
  const topMostThemeY = Math.min(...themeNodes.map((node) => node.position.y));
  const baseX = Math.max(leftMostThemeX, 688);
  let column = 0;
  let currentX = baseX;
  let currentY = topMostThemeY;
  let tallestInRow = 0;

  for (const themeNode of themeNodes) {
    const groupHeight = getGroupHeight(themeNode.memberIds.length);

    if (column >= GROUP_COLUMNS) {
      column = 0;
      currentX = baseX;
      currentY += tallestInRow + THEME_GRID_GAP_Y;
      tallestInRow = 0;
    }

    themeNode.position = { x: currentX, y: currentY };

    themeNode.memberIds.forEach((memberId, index) => {
      const memberNode = nodesById.get(memberId);
      if (!memberNode) {
        return;
      }

      const relativePosition = getDefaultGroupedPosition(index);
      memberNode.position = {
        x: currentX + relativePosition.x,
        y: currentY + relativePosition.y,
      };
    });

    tallestInRow = Math.max(tallestInRow, groupHeight);
    currentX += GROUP_WIDTH + THEME_GRID_GAP_X;
    column += 1;
  }

  return true;
}

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

function normalizeThemeLabel(label: string) {
  return label === "Round theme group" ? "Theme group" : label;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roundId: string }> }
) {
  const { roundId: consultationId } = await params;
  const client = await requireRouteClient();

  if ("response" in client) {
    return client.response;
  }

  try {
    // Verify consultation ownership
    await requireOwnedRound(consultationId, client.userId);

    const themeRows = await db
      .select()
      .from(themes)
      .where(
        and(eq(themes.consultationId, consultationId), eq(themes.userId, client.userId))
      );

    const memberRows = await db
      .select()
      .from(themeMembers)
      .where(
        and(
          eq(themeMembers.consultationId, consultationId),
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
      label: normalizeThemeLabel(theme.label),
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
        meetingTitle: meetings.title,
      })
      .from(insights)
      .innerJoin(meetings, eq(insights.meetingId, meetings.id))
      .where(
        and(
          eq(meetings.consultationId, consultationId),
          eq(meetings.userId, client.userId)
        )
      )
      .orderBy(asc(meetings.createdAt), asc(insights.createdAt));

    const insightNodes: CanvasNode[] = insightRows.map(({ insight, meetingTitle }) => ({
      id: insight.id,
      type: "insight",
      label: insight.label,
      description: insight.description,
      accepted: insight.accepted,
      subgroup: null,
      sourceConsultationId: insight.meetingId,
      sourceConsultationTitle: meetingTitle,
      groupId: groupIdByInsight.get(insight.id) ?? null,
      memberIds: [],
      isUserAdded: insight.isUserAdded,
      lockedFromSource: Boolean(groupIdByInsight.get(insight.id)),
      position: { x: 0, y: 0 },
    }));

    // Load connections and layout
    const [edges, layout] = await Promise.all([
      loadCanvasConnections(consultationId, client.userId),
      loadCanvasLayout(consultationId, client.userId),
    ]);

    // Apply saved positions to nodes
    const allNodes = [...insightNodes, ...themeNodes];
    buildFallbackPositions(allNodes);
    for (const node of allNodes) {
      if (layout.positions[node.id]) {
        node.position = layout.positions[node.id];
      }
    }

    const groupedThemeIdsMissingLayout = new Set(
      themeNodes
        .filter((node) => node.memberIds.length > 0 && !layout.positions[node.id])
        .map((node) => node.id)
    );

    let seededThemeGrid = false;
    if (groupedThemeIdsMissingLayout.size > 0) {
      seededThemeGrid = seedThemeGroupGrid(
        allNodes.filter(
          (node) =>
            (node.type === "theme" && groupedThemeIdsMissingLayout.has(node.id)) ||
            (node.type === "insight" && node.groupId && groupedThemeIdsMissingLayout.has(node.groupId))
        )
      );
    }

    const insightPositions = new Map(
      allNodes
        .filter((node) => node.type === "insight")
        .map((node) => [node.id, node.position] as const)
    );

    for (const node of allNodes) {
      if (
        node.type !== "theme" ||
        layout.positions[node.id] ||
        node.memberIds.length === 0 ||
        groupedThemeIdsMissingLayout.has(node.id)
      ) {
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
      round_id: consultationId,
      nodes: allNodes,
      edges,
      viewport: layout.viewport,
      needs_initial_layout_save: seededThemeGrid,
    });
  } catch (error) {
    console.error("[rounds/canvas/GET]", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to load canvas"
    );
  }
}
