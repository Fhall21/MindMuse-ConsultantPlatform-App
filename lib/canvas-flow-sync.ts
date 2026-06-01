import type { Node } from "@xyflow/react";
import type { CanvasNodeCardData } from "@/components/canvas/canvas-node-card";
import { orderNodesParentFirst } from "@/lib/canvas-flow-builders";

export function syncFlowNodes(
  currentNodes: Node[],
  nextNodes: Node[],
  selectedNodeIds: string[],
  pendingGroupDetaches: Set<string>
) {
  const currentById = new Map(currentNodes.map((node) => [node.id, node] as const));
  const nextById = new Map(nextNodes.map((node) => [node.id, node] as const));
  const selectedSet = new Set(selectedNodeIds);

  return orderNodesParentFirst(
    nextNodes.map((nextNode) => {
      const currentNode = currentById.get(nextNode.id);
      const currentData = currentNode?.data as unknown as CanvasNodeCardData | undefined;
      const nextData = nextNode.data as unknown as CanvasNodeCardData;
      const currentGroupId = currentData?.node?.groupId ?? null;
      const nextGroupId = nextData?.node?.groupId ?? null;
      const groupIdChanged = currentGroupId !== nextGroupId;
      const leftGroup = currentGroupId !== null && nextGroupId === null;
      const pendingDetach = pendingGroupDetaches.has(nextNode.id);

      // Keep the optimistic release position while the detach mutation is in
      // flight. Any join must accept the server/grid position immediately.
      if (pendingDetach && currentNode && currentGroupId === null && nextGroupId !== null) {
        return {
          ...nextNode,
          position: currentNode.position,
          selected: selectedSet.has(nextNode.id),
          data: {
            ...currentData,
            expanded: currentData?.expanded,
          } as Node["data"],
        } satisfies Node;
      }

      if (pendingDetach && nextGroupId === null) {
        pendingGroupDetaches.delete(nextNode.id);
      }

      const shouldPreservePosition =
        currentNode && currentNode.type === nextNode.type && (!groupIdChanged || leftGroup);

      if (shouldPreservePosition) {
        return {
          ...nextNode,
          position: currentNode.position,
          selected: selectedSet.has(nextNode.id),
          data: {
            ...nextData,
            expanded: currentData?.expanded,
          } as Node["data"],
        } satisfies Node;
      }

      const dataWithExpanded = (
        currentData?.expanded !== undefined
          ? { ...nextData, expanded: currentData.expanded }
          : nextData
      ) as unknown as Node["data"];

      // For grouped insights re-entering after their parent group was dragged,
      // shift by the delta between the group's runtime position and its DB-based position.
      const groupId = nextGroupId;
      if (groupId && !groupIdChanged) {
        const currentGroupNode = currentById.get(groupId);
        const nextGroupNode = nextById.get(groupId);
        if (currentGroupNode && nextGroupNode) {
          const deltaX = currentGroupNode.position.x - nextGroupNode.position.x;
          const deltaY = currentGroupNode.position.y - nextGroupNode.position.y;
          if (Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5) {
            return {
              ...nextNode,
              position: {
                x: nextNode.position.x + deltaX,
                y: nextNode.position.y + deltaY,
              },
              selected: selectedSet.has(nextNode.id),
              data: dataWithExpanded,
            } satisfies Node;
          }
        }
      }

      return {
        ...nextNode,
        selected: selectedSet.has(nextNode.id),
        data: dataWithExpanded,
      } satisfies Node;
    })
  );
}
