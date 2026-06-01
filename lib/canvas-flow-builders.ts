import type { Edge, Node } from "@xyflow/react";
import { CONNECTION_TYPE_LABELS } from "@/components/canvas/connection-type-prompt";
import { CONNECTION_COLORS } from "@/lib/canvas-constants";
import {
  getDefaultGroupedPosition,
  getGroupHeight,
  GROUP_HEADER_HEIGHT,
  GROUP_PADDING_TOP,
  GROUP_PADDING_X,
  GROUP_WIDTH,
  INSIGHT_HEIGHT,
  INSIGHT_WIDTH,
} from "@/lib/canvas-layout";
import type { CanvasNodeCardData } from "@/components/canvas/canvas-node-card";
import type { CanvasEdge, CanvasNode, ConnectionType } from "@/types/canvas";

export function edgeStyle(connectionType: ConnectionType) {
  return {
    stroke: CONNECTION_COLORS[connectionType],
    strokeWidth: 2.5,
    strokeDasharray: connectionType === "contradicts" ? "6 4" : undefined,
  };
}

function isRelativePositionInsideGroup(position: { x: number; y: number }, groupHeight: number) {
  return (
    position.x >= 12 &&
    position.x <= GROUP_WIDTH - INSIGHT_WIDTH - 12 &&
    position.y >= GROUP_HEADER_HEIGHT - 8 &&
    position.y <= groupHeight - INSIGHT_HEIGHT - 12
  );
}

export function buildFlowNodes(nodes: CanvasNode[], aiGeneratedGroupIds: Set<string>): Node[] {
  const nodesById = new Map(nodes.map((node) => [node.id, node] as const));
  const themeLayoutById = new Map<
    string,
    { position: { x: number; y: number }; height: number; memberIndexById: Map<string, number> }
  >();

  for (const themeNode of nodes.filter((node) => node.type === "theme")) {
    const memberPositions = themeNode.memberIds
      .map((memberId) => nodesById.get(memberId)?.position)
      .filter((position): position is { x: number; y: number } => Boolean(position));
    const height = getGroupHeight(themeNode.memberIds.length);
    let position = themeNode.position;

    if (memberPositions.length > 0) {
      const storedLayoutFits = memberPositions.every((memberPosition) =>
        isRelativePositionInsideGroup(
          {
            x: memberPosition.x - position.x,
            y: memberPosition.y - position.y,
          },
          height
        )
      );

      if (!storedLayoutFits) {
        const minX = Math.min(...memberPositions.map((memberPosition) => memberPosition.x));
        const minY = Math.min(...memberPositions.map((memberPosition) => memberPosition.y));
        position = {
          x: minX - GROUP_PADDING_X,
          y: minY - GROUP_HEADER_HEIGHT - GROUP_PADDING_TOP,
        };
      }
    }

    themeLayoutById.set(themeNode.id, {
      position,
      height,
      memberIndexById: new Map(themeNode.memberIds.map((memberId, index) => [memberId, index])),
    });
  }

  const themeNodes = nodes
    .filter((node) => node.type === "theme")
    .map((node) => {
      const layout = themeLayoutById.get(node.id);
      const height = layout?.height ?? getGroupHeight(node.memberIds.length);

      return {
        id: node.id,
        type: "canvasNode",
        position: layout?.position ?? node.position,
        draggable: true,
        selectable: true,
        zIndex: 0,
        style: {
          width: GROUP_WIDTH,
          height,
        },
        data: {
          node,
          isNestedInGroup: false,
          memberPreviewLabels: [],
          aiGenerated: aiGeneratedGroupIds.has(node.id),
          containerWidth: GROUP_WIDTH,
          containerHeight: height,
        } satisfies CanvasNodeCardData,
      } satisfies Node;
    });

  const insightNodes = nodes
    .filter((node) => node.type === "insight")
    .map((node) => {
      const groupLayout = node.groupId ? themeLayoutById.get(node.groupId) : null;
      const memberIndex = groupLayout?.memberIndexById.get(node.id) ?? 0;
      const slotPosition = getDefaultGroupedPosition(memberIndex);
      const absoluteSlotPosition = groupLayout
        ? {
            x: groupLayout.position.x + slotPosition.x,
            y: groupLayout.position.y + slotPosition.y,
          }
        : node.position;

      const absolutePosition =
        groupLayout &&
        isRelativePositionInsideGroup(
          {
            x: node.position.x - groupLayout.position.x,
            y: node.position.y - groupLayout.position.y,
          },
          groupLayout.height
        )
          ? node.position
          : absoluteSlotPosition;

      return {
        id: node.id,
        type: "canvasNode",
        position: absolutePosition,
        draggable: true,
        selectable: true,
        zIndex: 1,
        style: {
          width: INSIGHT_WIDTH,
        },
        data: {
          node,
          isNestedInGroup: Boolean(node.groupId),
          memberPreviewLabels: [],
          containerWidth: INSIGHT_WIDTH,
        } satisfies CanvasNodeCardData,
      } satisfies Node;
    });

  return orderNodesParentFirst([...themeNodes, ...insightNodes]);
}

export function orderNodesParentFirst(nodes: Node[]) {
  const nodeById = new Map(nodes.map((node) => [node.id, node] as const));
  const orderedNodes: Node[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(node: Node) {
    if (visited.has(node.id) || visiting.has(node.id)) {
      return;
    }

    visiting.add(node.id);

    if (node.parentId) {
      const parentNode = nodeById.get(node.parentId);
      if (parentNode) {
        visit(parentNode);
      }
    }

    visiting.delete(node.id);
    visited.add(node.id);
    orderedNodes.push(node);
  }

  for (const node of nodes) {
    visit(node);
  }

  return orderedNodes;
}

export function buildFlowEdges(edges: CanvasEdge[]): Edge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.source_node_id,
    target: edge.target_node_id,
    label: CONNECTION_TYPE_LABELS[edge.connection_type],
    animated: false,
    style: edgeStyle(edge.connection_type),
    labelStyle: {
      fontSize: 11,
    },
  }));
}
