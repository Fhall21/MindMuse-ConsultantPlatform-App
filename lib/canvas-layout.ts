"use client";

import dagre from "dagre";
import type { CanvasEdge, CanvasNode, CanvasPosition } from "@/types/canvas";

export const GROUP_COLUMNS = 2;
export const GROUP_WIDTH = 596;
export const GROUP_HEADER_HEIGHT = 118;
export const GROUP_PADDING_X = 28;
export const GROUP_PADDING_TOP = 24;
export const GROUP_PADDING_BOTTOM = 28;
export const GROUP_GAP_X = 24;
export const GROUP_GAP_Y = 22;
export const INSIGHT_WIDTH = 258;
export const INSIGHT_HEIGHT = 110;

const LAYOUT_NODE_SEP = 72;
const LAYOUT_RANK_SEP = 108;
const LAYOUT_MARGIN = 24;

interface ReorganisableNode {
  id: string;
  type: CanvasNode["type"];
  memberIds: string[];
  position: CanvasPosition;
  width: number;
  height: number;
}

export interface CanvasReorganiseLayoutResult {
  positions: Record<string, CanvasPosition>;
  movedNodeIds: string[];
  scope: "selected" | "all";
}

interface BuildCanvasReorganiseLayoutParams {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  selectedNodeIds: string[];
  runtimePositions?: Record<string, CanvasPosition>;
}

function getNodePosition(
  node: CanvasNode,
  runtimePositions: Record<string, CanvasPosition>
) {
  return runtimePositions[node.id] ?? node.position;
}

export function getGroupHeight(memberCount: number) {
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

export function getDefaultGroupedPosition(index: number) {
  const row = Math.floor(index / GROUP_COLUMNS);
  const column = index % GROUP_COLUMNS;

  return {
    x: GROUP_PADDING_X + column * (INSIGHT_WIDTH + GROUP_GAP_X),
    y: GROUP_HEADER_HEIGHT + GROUP_PADDING_TOP + row * (INSIGHT_HEIGHT + GROUP_GAP_Y),
  };
}

function getLayoutNodeDimensions(node: CanvasNode) {
  if (node.type === "theme") {
    return {
      width: GROUP_WIDTH,
      height: getGroupHeight(node.memberIds.length),
    };
  }

  return {
      width: INSIGHT_WIDTH,
      height: INSIGHT_HEIGHT,
  };
}

function resolveEligibleNodes(
  nodes: CanvasNode[],
  selectedNodeIds: string[],
  runtimePositions: Record<string, CanvasPosition>
) {
  const scope: "selected" | "all" =
    selectedNodeIds.length > 0 ? "selected" : "all";
  const selectedSet = new Set(selectedNodeIds);

  return {
    scope,
    nodes: nodes
      .filter((node) => {
        if (node.groupId) {
          return false;
        }

        if (scope === "selected" && !selectedSet.has(node.id)) {
          return false;
        }

        return true;
      })
      .map((node) => {
        const { width, height } = getLayoutNodeDimensions(node);

        return {
          id: node.id,
          type: node.type,
          memberIds: node.memberIds,
          position: getNodePosition(node, runtimePositions),
          width,
          height,
        } satisfies ReorganisableNode;
      }),
  };
}

function computeBoundingBox(nodes: ReorganisableNode[]) {
  return nodes.reduce(
    (box, node) => ({
      minX: Math.min(box.minX, node.position.x),
      minY: Math.min(box.minY, node.position.y),
      maxX: Math.max(box.maxX, node.position.x + node.width),
      maxY: Math.max(box.maxY, node.position.y + node.height),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    }
  );
}

function computeEntityId(
  nodeId: string,
  nodesById: Map<string, CanvasNode>,
  eligibleNodeIds: Set<string>
) {
  const node = nodesById.get(nodeId);
  if (!node) return null;

  if (eligibleNodeIds.has(node.id)) {
    return node.id;
  }

  if (node.groupId && eligibleNodeIds.has(node.groupId)) {
    return node.groupId;
  }

  return null;
}

export function buildCanvasReorganiseLayout({
  nodes,
  edges,
  selectedNodeIds,
  runtimePositions = {},
}: BuildCanvasReorganiseLayoutParams): CanvasReorganiseLayoutResult | null {
  const { nodes: eligibleNodes, scope } = resolveEligibleNodes(
    nodes,
    selectedNodeIds,
    runtimePositions
  );
  if (eligibleNodes.length < 2) {
    return null;
  }

  const nodesById = new Map(nodes.map((node) => [node.id, node] as const));
  const eligibleNodeIds = new Set(eligibleNodes.map((node) => node.id));
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: "LR",
    align: "UL",
    nodesep: LAYOUT_NODE_SEP,
    ranksep: LAYOUT_RANK_SEP,
    marginx: LAYOUT_MARGIN,
    marginy: LAYOUT_MARGIN,
  });

  eligibleNodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: node.width, height: node.height });
  });

  edges.forEach((edge) => {
    const sourceEntityId = computeEntityId(edge.source_node_id, nodesById, eligibleNodeIds);
    const targetEntityId = computeEntityId(edge.target_node_id, nodesById, eligibleNodeIds);

    if (
      !sourceEntityId ||
      !targetEntityId ||
      sourceEntityId === targetEntityId
    ) {
      return;
    }

    dagreGraph.setEdge(sourceEntityId, targetEntityId);
  });

  dagre.layout(dagreGraph);

  const currentBounds = computeBoundingBox(eligibleNodes);
  const currentNodeById = new Map(eligibleNodes.map((node) => [node.id, node] as const));
  const currentCenter = {
    x: (currentBounds.minX + currentBounds.maxX) / 2,
    y: (currentBounds.minY + currentBounds.maxY) / 2,
  };

  const laidOutNodes = eligibleNodes.map((node) => {
    const positioned = dagreGraph.node(node.id) ?? {
      x: node.width / 2,
      y: node.height / 2,
    };

    return {
      ...node,
      position: {
        x: positioned.x - node.width / 2,
        y: positioned.y - node.height / 2,
      },
    };
  });

  const laidOutBounds = computeBoundingBox(laidOutNodes);
  const laidOutCenter = {
    x: (laidOutBounds.minX + laidOutBounds.maxX) / 2,
    y: (laidOutBounds.minY + laidOutBounds.maxY) / 2,
  };
  const translation = {
    x: currentCenter.x - laidOutCenter.x,
    y: currentCenter.y - laidOutCenter.y,
  };

  const positions: Record<string, CanvasPosition> = {};
  const movedNodeIds = new Set<string>();

  laidOutNodes.forEach((node) => {
    const currentNode = currentNodeById.get(node.id);
    if (!currentNode) {
      return;
    }

    const nextPosition = {
      x: Math.round((node.position.x + translation.x) * 100) / 100,
      y: Math.round((node.position.y + translation.y) * 100) / 100,
    };
    const delta = {
      x: nextPosition.x - currentNode.position.x,
      y: nextPosition.y - currentNode.position.y,
    };

    positions[node.id] = nextPosition;
    movedNodeIds.add(node.id);

    if (node.type !== "theme") {
      return;
    }

    node.memberIds.forEach((memberId) => {
      const member = nodesById.get(memberId);
      if (!member) {
        return;
      }

      const memberPosition = getNodePosition(member, runtimePositions);
      positions[memberId] = {
        x: Math.round((memberPosition.x + delta.x) * 100) / 100,
        y: Math.round((memberPosition.y + delta.y) * 100) / 100,
      };
      movedNodeIds.add(memberId);
    });
  });

  return {
    positions,
    movedNodeIds: Array.from(movedNodeIds),
    scope,
  };
}
