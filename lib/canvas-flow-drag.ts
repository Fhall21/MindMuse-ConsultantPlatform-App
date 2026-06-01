import { applyNodeChanges, type Node, type NodeChange } from "@xyflow/react";
import type { CanvasNodeCardData } from "@/components/canvas/canvas-node-card";
import { orderNodesParentFirst } from "@/lib/canvas-flow-builders";

function getFlowCanvasNode(node: Node) {
  const data = node.data as unknown as CanvasNodeCardData | undefined;

  return data?.node ?? null;
}

export function translateGroupChildren(
  nodes: Node[],
  groupId: string,
  delta: { x: number; y: number }
) {
  return nodes.map((candidate) => {
    const canvasNode = getFlowCanvasNode(candidate);
    if (candidate.id === groupId || canvasNode?.groupId !== groupId) {
      return candidate;
    }

    return {
      ...candidate,
      position: {
        x: candidate.position.x + delta.x,
        y: candidate.position.y + delta.y,
      },
    } satisfies Node;
  });
}

export function applyThemeInsightNodeChanges(changes: NodeChange[], currentNodes: Node[]) {
  const themeDeltas = new Map<string, { x: number; y: number }>();

  for (const change of changes) {
    if (change.type !== "position" || !change.position) {
      continue;
    }

    const currentNode = currentNodes.find((candidate) => candidate.id === change.id);
    if (!currentNode) {
      continue;
    }

    const canvasNode = getFlowCanvasNode(currentNode);
    if (canvasNode?.type !== "theme") {
      continue;
    }

    themeDeltas.set(change.id, {
      x: change.position.x - currentNode.position.x,
      y: change.position.y - currentNode.position.y,
    });
  }

  let nextNodes = applyNodeChanges(changes, currentNodes);

  for (const [groupId, delta] of themeDeltas.entries()) {
    if (Math.abs(delta.x) < 0.5 && Math.abs(delta.y) < 0.5) {
      continue;
    }

    nextNodes = translateGroupChildren(nextNodes, groupId, delta);
  }

  return orderNodesParentFirst(nextNodes);
}
