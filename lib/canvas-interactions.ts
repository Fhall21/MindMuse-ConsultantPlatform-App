import type { CanvasNode } from "@/types/canvas";

export type CanvasGroupingPlan =
  | {
      type: "create-group";
      seedInsightIds: string[];
    }
  | {
      type: "add-to-group";
      targetGroupId: string;
      insightIds: string[];
    }
  | {
      type: "noop";
      reason: "missing-active" | "missing-target" | "invalid-target" | "no-insights";
    };

function isInsightNode(node: CanvasNode | undefined): node is CanvasNode {
  return node?.type === "insight";
}

export function getDraggedInsightIds(params: {
  activeNodeId: string | null;
  selectedNodeIds: string[];
  nodes: CanvasNode[];
}) {
  const { activeNodeId, selectedNodeIds, nodes } = params;
  if (!activeNodeId) {
    return [];
  }

  const selectedSet = new Set(selectedNodeIds);
  const dragIds =
    selectedSet.has(activeNodeId) && selectedSet.size > 1
      ? selectedNodeIds
      : [activeNodeId];

  return dragIds.filter((id) => nodes.some((node) => node.id === id && node.type === "insight"));
}

export function resolveCanvasGroupingPlan(params: {
  activeNodeId: string | null;
  targetNodeId: string | null;
  selectedNodeIds: string[];
  nodes: CanvasNode[];
}): CanvasGroupingPlan {
  const { activeNodeId, targetNodeId, selectedNodeIds, nodes } = params;
  if (!activeNodeId) {
    return { type: "noop", reason: "missing-active" };
  }
  if (!targetNodeId) {
    return { type: "noop", reason: "missing-target" };
  }

  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const draggedInsightIds = getDraggedInsightIds({
    activeNodeId,
    selectedNodeIds,
    nodes,
  });

  if (draggedInsightIds.length === 0) {
    return { type: "noop", reason: "no-insights" };
  }

  const targetNode = nodesById.get(targetNodeId);
  if (!targetNode) {
    return { type: "noop", reason: "missing-target" };
  }

  const draggedSet = new Set(draggedInsightIds);

  if (targetNode.type === "theme") {
    const insightIds = draggedInsightIds.filter((id) => {
      const node = nodesById.get(id);
      return node?.groupId !== targetNode.id;
    });

    return insightIds.length > 0
      ? { type: "add-to-group", targetGroupId: targetNode.id, insightIds }
      : { type: "noop", reason: "invalid-target" };
  }

  if (!isInsightNode(targetNode)) {
    return { type: "noop", reason: "invalid-target" };
  }

  if (draggedSet.has(targetNode.id) && draggedSet.size === 1) {
    return { type: "noop", reason: "invalid-target" };
  }

  if (targetNode.groupId) {
    const insightIds = draggedInsightIds.filter((id) => {
      const node = nodesById.get(id);
      return node?.groupId !== targetNode.groupId;
    });

    return insightIds.length > 0
      ? { type: "add-to-group", targetGroupId: targetNode.groupId, insightIds }
      : { type: "noop", reason: "invalid-target" };
  }

  const seedInsightIds = Array.from(new Set([...draggedInsightIds, targetNode.id]));
  return seedInsightIds.length >= 2
    ? { type: "create-group", seedInsightIds }
    : { type: "noop", reason: "invalid-target" };
}
