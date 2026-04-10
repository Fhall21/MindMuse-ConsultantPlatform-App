"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyNodeChanges,
  Background,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type EdgeMouseHandler,
  type Node,
  type NodeMouseHandler,
  type NodeChange,
  type OnNodeDrag,
  type OnSelectionChangeFunc,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { CanvasNodeCard, type CanvasNodeCardData } from "@/components/canvas/canvas-node-card";
import { CONNECTION_TYPE_LABELS } from "@/components/canvas/connection-type-prompt";
import { useCanvas, useSaveLayout, type CreateEdgePayload } from "@/hooks/use-canvas";
import {
  buildCanvasReorganiseLayout,
  type CanvasLayoutDirection,
  getDefaultGroupedPosition,
  getGroupHeight,
  GROUP_HEADER_HEIGHT,
  GROUP_PADDING_X,
  GROUP_PADDING_TOP,
  INSIGHT_HEIGHT,
  INSIGHT_WIDTH,
  GROUP_WIDTH,
} from "@/lib/canvas-layout";
import { getDraggedInsightIds, resolveCanvasGroupingPlan } from "@/lib/canvas-interactions";
import type { CanvasEdge, CanvasFilterState, CanvasNode, ConnectionType } from "@/types/canvas";

interface CanvasGraphProps {
  roundId: string;
  filters: CanvasFilterState;
  selectedNodeIds: string[];
  selectedEdgeId: string | null;
  aiGeneratedGroupIds?: Set<string>;
  layoutRequest?: { id: number; nodeIds: string[]; direction: CanvasLayoutDirection } | null;
  onSelectionChange: (nodeIds: string[]) => void;
  onNodeFocus: (id: string | null) => void;
  onEdgeSelect: (id: string | null) => void;
  onLayoutComplete?: (result: {
    applied: boolean;
    movedNodeIds: string[];
    scope: "selected" | "all";
    direction: CanvasLayoutDirection;
  }) => void;
  onCreateEdge: (payload: CreateEdgePayload) => Promise<CanvasEdge>;
  onGroupDrop: (params: {
    activeNodeId: string;
    targetNodeId: string | null;
    targetGroupId?: string | null;
    insertionIndex?: number;
  }) => Promise<void>;
}

const CONNECTION_COLORS: Record<ConnectionType, string> = {
  causes: "#ef4444",
  influences: "#f97316",
  supports: "#22c55e",
  contradicts: "#dc2626",
  related_to: "#6b7280",
};

// Canvas interaction contract:
// 1. Use React Flow local node state so drag stays locked to the cursor.
// 2. Keep persisted DB positions absolute and manage grouping in app state so
//    React Flow never needs nested parent/child nodes.
const nodeTypes = {
  canvasNode: CanvasNodeCard,
};

function edgeStyle(connectionType: ConnectionType) {
  return {
    stroke: CONNECTION_COLORS[connectionType],
    strokeWidth: 2.5,
    strokeDasharray: connectionType === "contradicts" ? "6 4" : undefined,
  };
}

function applyFilters(nodes: CanvasNode[], edges: CanvasEdge[], filters: CanvasFilterState) {
  const query = filters.searchQuery.trim().toLowerCase();

  const filteredNodes = nodes.filter((node) => {
    if (!filters.nodeTypes.includes(node.type)) return false;
    if (filters.acceptedOnly && !node.accepted) return false;
    if (query && !`${node.label} ${node.description ?? ""}`.toLowerCase().includes(query)) {
      return false;
    }
    return true;
  });

  const visibleIds = new Set(filteredNodes.map((node) => node.id));
  const filteredEdges = edges.filter(
    (edge) =>
      filters.connectionTypes.includes(edge.connection_type) &&
      visibleIds.has(edge.source_node_id) &&
      visibleIds.has(edge.target_node_id)
  );

  return { filteredNodes, filteredEdges };
}

function isRelativePositionInsideGroup(position: { x: number; y: number }, groupHeight: number) {
  return (
    position.x >= 12 &&
    position.x <= GROUP_WIDTH - INSIGHT_WIDTH - 12 &&
    position.y >= GROUP_HEADER_HEIGHT - 8 &&
    position.y <= groupHeight - INSIGHT_HEIGHT - 12
  );
}

function buildFlowNodes(nodes: CanvasNode[], aiGeneratedGroupIds: Set<string>): Node[] {
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
        groupLayout && isRelativePositionInsideGroup({ x: node.position.x - groupLayout.position.x, y: node.position.y - groupLayout.position.y }, groupLayout.height)
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

function orderNodesParentFirst(nodes: Node[]) {
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

function buildFlowEdges(edges: CanvasEdge[]): Edge[] {
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

function syncFlowNodes(currentNodes: Node[], nextNodes: Node[], selectedNodeIds: string[]) {
  const currentById = new Map(currentNodes.map((node) => [node.id, node] as const));
  const selectedSet = new Set(selectedNodeIds);

  return orderNodesParentFirst(
    nextNodes.map((nextNode) => {
      const currentNode = currentById.get(nextNode.id);
      const shouldPreservePosition = currentNode && currentNode.type === nextNode.type;

      return {
        ...nextNode,
        position: shouldPreservePosition ? currentNode.position : nextNode.position,
        selected: selectedSet.has(nextNode.id),
      } satisfies Node;
    })
  );
}

function syncFlowEdges(currentEdges: Edge[], nextEdges: Edge[], selectedEdgeId: string | null) {
  const currentById = new Map(currentEdges.map((edge) => [edge.id, edge] as const));

  return nextEdges.map((nextEdge) => ({
    ...nextEdge,
    animated: selectedEdgeId === nextEdge.id,
    selected: selectedEdgeId === nextEdge.id,
    data: currentById.get(nextEdge.id)?.data,
  } satisfies Edge));
}

function buildLayoutPositions(allNodes: Node[], nodesById: Map<string, CanvasNode>) {
  return Object.fromEntries(
    allNodes
      .map((node) => {
        const original = nodesById.get(node.id);
        if (!original) {
          return null;
        }

        return [
          node.id,
          {
            nodeType: original.type,
            x: node.position.x,
            y: node.position.y,
          },
        ];
      })
      .filter(Boolean) as Array<[string, { nodeType: CanvasNode["type"]; x: number; y: number }]>
  );
}

function getFlowCanvasNode(node: Node) {
  const data = node.data as unknown as CanvasNodeCardData | undefined;

  return data?.node ?? null;
}

function resolveDropTargetNode(intersectingNodeIds: string[], nodes: Node[], draggedNodeId: string) {
  const candidates = intersectingNodeIds
    .filter((candidateId) => candidateId !== draggedNodeId)
    .map((candidateId) => nodes.find((candidate) => candidate.id === candidateId) ?? null)
    .filter((candidate): candidate is Node => Boolean(candidate));

  return (
    candidates.find((candidate) => getFlowCanvasNode(candidate)?.type === "insight") ??
    candidates.find((candidate) => getFlowCanvasNode(candidate)?.type === "theme") ??
    null
  );
}

function snapGroupChildren(nodes: Node[], groupId: string) {
  const groupChildren = getOrderedGroupChildren(nodes, groupId);
  const groupNode = nodes.find((candidate) => candidate.id === groupId);

  if (groupChildren.length === 0 || !groupNode) {
    return nodes;
  }

  const snappedPositions = new Map(
    groupChildren.map((child, index) => [child.id, getDefaultGroupedPosition(index)] as const)
  );

  return nodes.map((candidate) => {
    const canvasNode = getFlowCanvasNode(candidate);
    if (candidate.id === groupId || canvasNode?.groupId !== groupId) {
      return candidate;
    }

    const snappedPosition = snappedPositions.get(candidate.id);
    if (!snappedPosition) {
      return candidate;
    }

    return {
      ...candidate,
      position: {
        x: groupNode.position.x + snappedPosition.x,
        y: groupNode.position.y + snappedPosition.y,
      },
    } satisfies Node;
  });
}

function getOrderedGroupChildren(nodes: Node[], groupId: string) {
  return nodes
    .filter((candidate) => getFlowCanvasNode(candidate)?.groupId === groupId)
    .sort((left, right) => {
      if (left.position.y === right.position.y) {
        return left.position.x - right.position.x;
      }

      return left.position.y - right.position.y;
    });
}

function reorderGroupChildren(params: {
  nodes: Node[];
  groupId: string;
  draggedNodeIds: string[];
  insertionIndex: number;
}) {
  const { nodes, groupId, draggedNodeIds, insertionIndex } = params;
  const groupChildren = getOrderedGroupChildren(nodes, groupId);
  const groupNode = nodes.find((candidate) => candidate.id === groupId);
  if (!groupNode) {
    return nodes;
  }
  const draggedSet = new Set(draggedNodeIds);
  const reorderedIds = groupChildren
    .map((child) => child.id)
    .filter((childId) => !draggedSet.has(childId));
  const boundedIndex = Math.max(0, Math.min(insertionIndex, reorderedIds.length));

  reorderedIds.splice(boundedIndex, 0, ...draggedNodeIds);

  const snappedPositions = new Map(
    reorderedIds.map((childId, index) => [childId, getDefaultGroupedPosition(index)] as const)
  );

  return nodes.map((candidate) => {
    const canvasNode = getFlowCanvasNode(candidate);
    if (!draggedSet.has(candidate.id) && canvasNode?.groupId !== groupId) {
      return candidate;
    }

    const snappedPosition = snappedPositions.get(candidate.id);
    if (!snappedPosition) {
      return candidate;
    }

    return {
      ...candidate,
      position: {
        x: groupNode.position.x + snappedPosition.x,
        y: groupNode.position.y + snappedPosition.y,
      },
    } satisfies Node;
  });
}

function translateGroupChildren(nodes: Node[], groupId: string, delta: { x: number; y: number }) {
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

function applyThemeDragTranslations(changes: NodeChange[], currentNodes: Node[]) {
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

  if (themeDeltas.size === 0) {
    return applyNodeChanges(changes, currentNodes);
  }

  let nextNodes = applyNodeChanges(changes, currentNodes);

  for (const [groupId, delta] of themeDeltas.entries()) {
    if (Math.abs(delta.x) < 0.5 && Math.abs(delta.y) < 0.5) {
      continue;
    }

    nextNodes = translateGroupChildren(nextNodes, groupId, delta);
  }

  return nextNodes;
}

function CanvasGraphInner({
  roundId,
  filters,
  selectedNodeIds,
  selectedEdgeId,
  aiGeneratedGroupIds = new Set(),
  layoutRequest,
  onSelectionChange,
  onNodeFocus,
  onEdgeSelect,
  onLayoutComplete,
  onCreateEdge,
  onGroupDrop,
}: CanvasGraphProps) {
  const { data, isLoading } = useCanvas(roundId);
  const saveLayout = useSaveLayout(roundId);
  const { getViewport, getIntersectingNodes } = useReactFlow();
  const dragRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const layoutResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragSelectionRef = useRef(false);
  const clickHandlingRef = useRef(false);
  const initialSeedSaveRef = useRef<string | null>(null);
  const processedLayoutRequestRef = useRef<number | null>(null);
  const [hasQueuedSave, setHasQueuedSave] = useState(false);
  const [hasHydratedGraph, setHasHydratedGraph] = useState(false);
  const lastViewportRef = useRef(data?.viewport ?? { x: 0, y: 0, zoom: 1 });

  const selectedNodeIdsRef = useRef(selectedNodeIds);
  selectedNodeIdsRef.current = selectedNodeIds;

  const nodesDataRef = useRef(data?.nodes ?? []);
  nodesDataRef.current = data?.nodes ?? [];

  const nodesById = useMemo(
    () => new Map((data?.nodes ?? []).map((node) => [node.id, node] as const)),
    [data?.nodes]
  );

  const { filteredNodes, filteredEdges } = useMemo(
    () => applyFilters(data?.nodes ?? [], data?.edges ?? [], filters),
    [data?.nodes, data?.edges, filters]
  );

  const allFlowNodes = useMemo(
    () => buildFlowNodes(data?.nodes ?? [], aiGeneratedGroupIds),
    [data?.nodes, aiGeneratedGroupIds]
  );
  const normalizedAllPositions = useMemo(
    () => buildLayoutPositions(allFlowNodes, nodesById),
    [allFlowNodes, nodesById]
  );
  const normalizedLayoutSignature = useMemo(
    () =>
      Object.entries(normalizedAllPositions)
        .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
        .map(([id, position]) => `${id}:${position.x}:${position.y}`)
        .join("|"),
    [normalizedAllPositions]
  );
  const needsLayoutNormalization = useMemo(
    () =>
      Object.entries(normalizedAllPositions).some(([nodeId, position]) => {
        const original = nodesById.get(nodeId);

        return (
          original &&
          (Math.abs(original.position.x - position.x) > 0.5 ||
            Math.abs(original.position.y - position.y) > 0.5)
        );
      }),
    [nodesById, normalizedAllPositions]
  );

  const nextFlowNodes = useMemo(
    () => buildFlowNodes(filteredNodes, aiGeneratedGroupIds),
    [filteredNodes, aiGeneratedGroupIds]
  );
  const nextFlowEdges = useMemo(() => buildFlowEdges(filteredEdges), [filteredEdges]);

  const [flowNodes, setFlowNodes] = useNodesState(nextFlowNodes);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState(nextFlowEdges);
  const renderedFlowNodes = useMemo(() => orderNodesParentFirst(flowNodes), [flowNodes]);
  const flowNodesRef = useRef(flowNodes);
  flowNodesRef.current = flowNodes;

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setFlowNodes((currentNodes) =>
        orderNodesParentFirst(applyThemeDragTranslations(changes, currentNodes))
      );
    },
    [setFlowNodes]
  );

  // Preserve runtime positions while dragging/selecting. Recomputing from server
  // data on every render reintroduces cursor lag and snap-back.
  useEffect(() => {
    setFlowNodes((currentNodes) =>
      syncFlowNodes(currentNodes, nextFlowNodes, selectedNodeIds)
    );
  }, [nextFlowNodes, selectedNodeIds, setFlowNodes]);

  useEffect(() => {
    setFlowEdges((currentEdges) =>
      syncFlowEdges(currentEdges, nextFlowEdges, selectedEdgeId)
    );
  }, [nextFlowEdges, selectedEdgeId, setFlowEdges]);

  useEffect(() => {
    if (data) {
      setHasHydratedGraph(true);
      lastViewportRef.current = data.viewport;
    }
  }, [data]);

  const saveLayoutNow = useCallback(
    (positions: Record<string, { nodeType: CanvasNode["type"]; x: number; y: number }>, viewport: { x: number; y: number; zoom: number }) => {
      setHasQueuedSave(false);
      saveLayout.mutate(
        {
          positions,
          viewport,
        },
        {
          onError: (error) => {
            console.error("[canvas-graph] failed to save layout", error);
            toast.error("Failed to save canvas layout.");
          },
        }
      );
    },
    [saveLayout]
  );

  useEffect(() => {
    if (!data) {
      return;
    }

    if (!(data.needs_initial_layout_save || needsLayoutNormalization)) {
      return;
    }

    const saveKey = `${roundId}:${normalizedLayoutSignature}`;
    if (initialSeedSaveRef.current === saveKey) {
      return;
    }

    initialSeedSaveRef.current = saveKey;
    saveLayoutNow(normalizedAllPositions, data.viewport);
  }, [data, needsLayoutNormalization, normalizedAllPositions, normalizedLayoutSignature, roundId, saveLayoutNow]);

  const handleNodeClick: NodeMouseHandler = useCallback(
    (event, node) => {
      event.preventDefault();
      clickHandlingRef.current = true;
      const isMultiToggle = event.metaKey || event.ctrlKey || event.shiftKey;
      if (isMultiToggle) {
        const next = new Set(selectedNodeIdsRef.current);
        if (next.has(node.id)) {
          next.delete(node.id);
        } else {
          next.add(node.id);
        }
        onSelectionChange(Array.from(next));
        onNodeFocus(null);
      } else {
        onSelectionChange([node.id]);
        onNodeFocus(node.id);
      }
      onEdgeSelect(null);
      Promise.resolve().then(() => {
        clickHandlingRef.current = false;
      });
    },
    [onEdgeSelect, onNodeFocus, onSelectionChange]
  );

  const handleSelectionChange = useCallback<OnSelectionChangeFunc>(
    ({ nodes }) => {
      if (dragSelectionRef.current || clickHandlingRef.current) {
        return;
      }
      onSelectionChange(nodes.map((node) => node.id));
      onNodeFocus(nodes.length > 0 ? nodes[nodes.length - 1]?.id ?? null : null);
    },
    [onNodeFocus, onSelectionChange]
  );

  const handleEdgeClick: EdgeMouseHandler = useCallback(
    (_event, edge) => {
      onEdgeSelect(edge.id);
      onSelectionChange([]);
      onNodeFocus(null);
    },
    [onEdgeSelect, onNodeFocus, onSelectionChange]
  );

  const handlePaneClick = useCallback(() => {
    onSelectionChange([]);
    onNodeFocus(null);
    onEdgeSelect(null);
  }, [onEdgeSelect, onNodeFocus, onSelectionChange]);

  const handleConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) {
        return;
      }

      const sourceNode = nodesById.get(connection.source);
      const targetNode = nodesById.get(connection.target);
      if (!sourceNode || !targetNode) {
        return;
      }

      try {
        const edge = await onCreateEdge({
          source_node_type: sourceNode.type,
          source_node_id: sourceNode.id,
          target_node_type: targetNode.type,
          target_node_id: targetNode.id,
          connection_type: "related_to",
        });

        onEdgeSelect(edge.id);
        onNodeFocus(null);
        onSelectionChange([]);
      } catch (error) {
        console.error("[canvas-graph] failed to create edge", error);
        onSelectionChange([]);
        onNodeFocus(null);
        onEdgeSelect(null);
        toast.error("Failed to create connection.");
      }
    },
    [nodesById, onCreateEdge, onEdgeSelect, onNodeFocus, onSelectionChange]
  );

  const persistLayout = useCallback(
    (allNodes: Node[]) => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      setHasQueuedSave(true);
      saveTimerRef.current = setTimeout(() => {
        saveLayoutNow(buildLayoutPositions(allNodes, nodesById), getViewport());
      }, 1500);
    },
    [getViewport, nodesById, saveLayoutNow]
  );

  useEffect(
    () => () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      if (layoutResetTimerRef.current) {
        clearTimeout(layoutResetTimerRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (!data || !layoutRequest) {
      return;
    }

    if (processedLayoutRequestRef.current === layoutRequest.id) {
      return;
    }

    processedLayoutRequestRef.current = layoutRequest.id;

    const runtimePositions = Object.fromEntries(
      flowNodesRef.current.map((node) => [node.id, node.position] as const)
    );
    const layoutResult = buildCanvasReorganiseLayout({
      nodes: nodesDataRef.current,
      edges: data.edges,
      selectedNodeIds: layoutRequest.nodeIds,
      direction: layoutRequest.direction,
      runtimePositions,
    });

    if (!layoutResult) {
      Promise.resolve().then(() =>
        onLayoutComplete?.({
          applied: false,
          movedNodeIds: [],
          scope: layoutRequest.nodeIds.length > 0 ? "selected" : "all",
          direction: layoutRequest.direction,
        })
      );
      return;
    }

    if (layoutResetTimerRef.current) {
      clearTimeout(layoutResetTimerRef.current);
    }

    const transition = "transform 280ms cubic-bezier(0.22, 1, 0.36, 1)";
    const nextNodes = orderNodesParentFirst(
      flowNodesRef.current.map((node) => {
        const nextPosition = layoutResult.positions[node.id];
        if (!nextPosition) {
          return node;
        }

        return {
          ...node,
          position: nextPosition,
          style: {
            ...node.style,
            transition,
          },
        } satisfies Node;
      })
    );

    flowNodesRef.current = nextNodes;
    setFlowNodes(nextNodes);
    saveLayoutNow(buildLayoutPositions(nextNodes, nodesById), getViewport());

    layoutResetTimerRef.current = setTimeout(() => {
      setFlowNodes((currentNodes) =>
        currentNodes.map((node) => {
          if (!(node.id in layoutResult.positions)) {
            return node;
          }

          const nextStyle = { ...node.style };
          delete nextStyle.transition;

          return {
            ...node,
            style: nextStyle,
          } satisfies Node;
        })
      );
    }, 320);

    Promise.resolve().then(() =>
      onLayoutComplete?.({
        applied: true,
        movedNodeIds: layoutResult.movedNodeIds,
        scope: layoutResult.scope,
        direction: layoutRequest.direction,
      })
    );
  }, [data, getViewport, layoutRequest, nodesById, onLayoutComplete, saveLayoutNow, setFlowNodes]);

  const handleNodeDragStart: OnNodeDrag = useCallback((_event, node) => {
    dragRef.current = node.id;
    dragSelectionRef.current = true;
  }, []);

  const handleNodeDragStop: OnNodeDrag = useCallback(
    async (_event, node, allNodes) => {
      const draggedNodeId = dragRef.current ?? node.id;
      const draggedNodeBeforeDrag = nodesDataRef.current.find((candidate) => candidate.id === draggedNodeId);
      const runtimeNodes = flowNodesRef.current;
      const draggedNodeAfterDrop = runtimeNodes.find((candidate) => candidate.id === draggedNodeId) ?? allNodes.find((candidate) => candidate.id === draggedNodeId);
      const draggedInsightIds = getDraggedInsightIds({
        activeNodeId: draggedNodeId,
        selectedNodeIds: selectedNodeIdsRef.current,
        nodes: nodesDataRef.current,
      });
      const intersectingNodeIds = getIntersectingNodes(node).map((candidate) => candidate.id);
      const targetRuntimeNode = resolveDropTargetNode(intersectingNodeIds, runtimeNodes, draggedNodeId);
      const targetNodeId = targetRuntimeNode?.id ?? null;
      const targetCanvasNode = targetRuntimeNode ? getFlowCanvasNode(targetRuntimeNode) : null;
      const targetGroupId =
        targetCanvasNode?.type === "theme"
          ? targetCanvasNode.id
          : targetCanvasNode?.groupId ?? null;
      const groupChildren = targetGroupId ? getOrderedGroupChildren(runtimeNodes, targetGroupId) : [];
      const insertionIndex =
        targetCanvasNode?.type === "insight" && targetGroupId
          ? Math.max(
              0,
              groupChildren.findIndex((candidate) => candidate.id === targetCanvasNode.id)
            )
          : targetGroupId
            ? groupChildren.filter((candidate) => !draggedInsightIds.includes(candidate.id)).length
            : undefined;

      const plan = resolveCanvasGroupingPlan({
        activeNodeId: draggedNodeId,
        targetNodeId,
        selectedNodeIds: selectedNodeIdsRef.current,
        nodes: nodesDataRef.current,
      });

      const themeDelta =
        draggedNodeBeforeDrag?.type === "theme" && draggedNodeAfterDrop
          ? {
              x: draggedNodeAfterDrop.position.x - draggedNodeBeforeDrag.position.x,
              y: draggedNodeAfterDrop.position.y - draggedNodeBeforeDrag.position.y,
            }
          : null;

      const settledNodes =
        targetGroupId && draggedInsightIds.length > 0 && typeof insertionIndex === "number"
          ? reorderGroupChildren({
              nodes: runtimeNodes,
              groupId: targetGroupId,
              draggedNodeIds: draggedInsightIds,
              insertionIndex,
            })
          : draggedNodeBeforeDrag?.type === "theme" && themeDelta
            ? runtimeNodes
            : plan.type === "noop" && draggedNodeBeforeDrag?.type === "insight" && draggedNodeBeforeDrag.groupId
              ? snapGroupChildren(runtimeNodes, draggedNodeBeforeDrag.groupId)
            : runtimeNodes;

      const settledFlowNodes = orderNodesParentFirst(settledNodes);
      setFlowNodes(settledFlowNodes);
      persistLayout(settledFlowNodes);
      dragRef.current = null;
      dragSelectionRef.current = false;

      if (targetGroupId && typeof insertionIndex === "number") {
        void onGroupDrop({
          activeNodeId: draggedNodeId,
          targetNodeId,
          targetGroupId,
          insertionIndex,
        });
      } else if (draggedNodeBeforeDrag?.type === "insight" && draggedNodeBeforeDrag.groupId && !targetNodeId) {
        void onGroupDrop({ activeNodeId: draggedNodeId, targetNodeId: null });
      }
    },
    [getIntersectingNodes, onGroupDrop, persistLayout, setFlowNodes]
  );

  if (!hasHydratedGraph && (isLoading || !data)) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading evidence network…
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={renderedFlowNodes}
      edges={flowEdges}
      nodeTypes={nodeTypes}
      defaultViewport={data?.viewport ?? lastViewportRef.current}
      onNodesChange={handleNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={handleNodeClick}
      onEdgeClick={handleEdgeClick}
      onPaneClick={handlePaneClick}
      onSelectionChange={handleSelectionChange}
      onNodeDragStart={handleNodeDragStart}
      onNodeDragStop={handleNodeDragStop}
      onConnect={handleConnect}
      multiSelectionKeyCode={["Meta", "Control", "Shift"]}
      selectionOnDrag
      panOnScroll
      fitView={false}
      minZoom={0.15}
      maxZoom={2}
      defaultEdgeOptions={{
        style: edgeStyle("related_to"),
      }}
    >
      <Background gap={16} size={1} />
      {hasQueuedSave || saveLayout.isPending ? (
        <Panel position="top-right">
          <div className="flex items-center gap-2 rounded-full border bg-background/95 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Saving layout…
          </div>
        </Panel>
      ) : null}
      <Controls />
      <MiniMap nodeStrokeWidth={3} zoomable pannable />
    </ReactFlow>
  );
}

export function CanvasGraph(props: CanvasGraphProps) {
  return (
    <ReactFlowProvider>
      <CanvasGraphInner {...props} />
    </ReactFlowProvider>
  );
}
