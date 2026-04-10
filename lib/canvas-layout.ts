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

export type CanvasLayoutDirection = "LR" | "TB" | "RL" | "BT";

const LAYOUT_NODE_SEP = 72;
const LAYOUT_RANK_SEP = 108;
const LAYOUT_EDGE_SEP = 40;
const LAYOUT_MARGIN = 24;
const COMPONENT_GAP = 136;

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
  direction?: CanvasLayoutDirection;
  runtimePositions?: Record<string, CanvasPosition>;
}

interface EntityEdge {
  source: string;
  target: string;
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

function dedupeEntityEdges(edges: EntityEdge[]) {
  const seen = new Set<string>();

  return edges.filter((edge) => {
    const key = `${edge.source}->${edge.target}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function buildEntityEdges(
  edges: CanvasEdge[],
  nodesById: Map<string, CanvasNode>,
  eligibleNodeIds: Set<string>
) {
  return dedupeEntityEdges(
    edges
      .map((edge) => {
        const sourceEntityId = computeEntityId(edge.source_node_id, nodesById, eligibleNodeIds);
        const targetEntityId = computeEntityId(edge.target_node_id, nodesById, eligibleNodeIds);

        if (!sourceEntityId || !targetEntityId || sourceEntityId === targetEntityId) {
          return null;
        }

        return {
          source: sourceEntityId,
          target: targetEntityId,
        } satisfies EntityEdge;
      })
      .filter((edge): edge is EntityEdge => Boolean(edge))
  );
}

function getSecondaryAxisValue(
  node: ReorganisableNode,
  direction: CanvasLayoutDirection
) {
  return direction === "LR" || direction === "RL" ? node.position.y : node.position.x;
}

function findConnectedComponents(
  nodes: ReorganisableNode[],
  edges: EntityEdge[]
) {
  const adjacency = new Map<string, Set<string>>();
  const nodesById = new Map(nodes.map((node) => [node.id, node] as const));

  nodes.forEach((node) => {
    adjacency.set(node.id, new Set());
  });

  edges.forEach((edge) => {
    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  });

  const visited = new Set<string>();
  const components: ReorganisableNode[][] = [];

  for (const node of nodes) {
    if (visited.has(node.id)) {
      continue;
    }

    const stack = [node.id];
    const component: ReorganisableNode[] = [];
    visited.add(node.id);

    while (stack.length > 0) {
      const nextId = stack.pop();
      if (!nextId) {
        continue;
      }

      const nextNode = nodesById.get(nextId);
      if (nextNode) {
        component.push(nextNode);
      }

      adjacency.get(nextId)?.forEach((adjacentId) => {
        if (visited.has(adjacentId)) {
          return;
        }

        visited.add(adjacentId);
        stack.push(adjacentId);
      });
    }

    components.push(component);
  }

  return components;
}

function layoutComponent(
  nodes: ReorganisableNode[],
  edges: EntityEdge[],
  direction: CanvasLayoutDirection
) {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: direction,
    align: "UL",
    nodesep: LAYOUT_NODE_SEP,
    ranksep: LAYOUT_RANK_SEP,
    edgesep: LAYOUT_EDGE_SEP,
    marginx: LAYOUT_MARGIN,
    marginy: LAYOUT_MARGIN,
    ranker: "tight-tree",
    acyclicer: "greedy",
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: node.width, height: node.height });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target, {
      minlen: 1,
      weight: 3,
    });
  });

  dagre.layout(dagreGraph);

  return nodes.map((node) => {
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
}

export function buildCanvasReorganiseLayout({
  nodes,
  edges,
  selectedNodeIds,
  direction = "LR",
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
  const entityEdges = buildEntityEdges(edges, nodesById, eligibleNodeIds);

  const currentBounds = computeBoundingBox(eligibleNodes);
  const currentNodeById = new Map(eligibleNodes.map((node) => [node.id, node] as const));
  const currentCenter = {
    x: (currentBounds.minX + currentBounds.maxX) / 2,
    y: (currentBounds.minY + currentBounds.maxY) / 2,
  };

  let secondaryOffset = 0;
  const laidOutNodes = findConnectedComponents(eligibleNodes, entityEdges)
    .sort((left, right) => {
      const leftAnchor = Math.min(...left.map((node) => getSecondaryAxisValue(node, direction)));
      const rightAnchor = Math.min(...right.map((node) => getSecondaryAxisValue(node, direction)));
      return leftAnchor - rightAnchor;
    })
    .flatMap((componentNodes) => {
      const componentIds = new Set(componentNodes.map((node) => node.id));
      const componentEdges = entityEdges.filter(
        (edge) => componentIds.has(edge.source) && componentIds.has(edge.target)
      );
      const laidOutComponent = layoutComponent(componentNodes, componentEdges, direction);
      const componentBounds = computeBoundingBox(laidOutComponent);
      const adjustedComponent = laidOutComponent.map((node) => {
        if (direction === "LR" || direction === "RL") {
          return {
            ...node,
            position: {
              x: node.position.x,
              y: node.position.y - componentBounds.minY + secondaryOffset,
            },
          };
        }

        return {
          ...node,
          position: {
            x: node.position.x - componentBounds.minX + secondaryOffset,
            y: node.position.y,
          },
        };
      });

      secondaryOffset +=
        (direction === "LR" || direction === "RL"
          ? componentBounds.maxY - componentBounds.minY
          : componentBounds.maxX - componentBounds.minX) + COMPONENT_GAP;

      return adjustedComponent;
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
