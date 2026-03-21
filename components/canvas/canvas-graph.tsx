"use client";

import { useCallback, useMemo, useRef } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type EdgeMouseHandler,
  type Node,
  type NodeMouseHandler,
  type OnNodeDrag,
  type OnSelectionChangeFunc,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { CanvasNodeCard, type CanvasNodeCardData } from "@/components/canvas/canvas-node-card";
import { CONNECTION_TYPE_LABELS } from "@/components/canvas/connection-type-prompt";
import { useCanvas, useSaveLayout, type CreateEdgePayload } from "@/hooks/use-canvas";
import { resolveCanvasGroupingPlan } from "@/lib/canvas-interactions";
import type { CanvasEdge, CanvasFilterState, CanvasNode, ConnectionType } from "@/types/canvas";

interface CanvasGraphProps {
  roundId: string;
  filters: CanvasFilterState;
  selectedNodeIds: string[];
  selectedEdgeId: string | null;
  aiGeneratedGroupIds?: Set<string>;
  onSelectionChange: (nodeIds: string[]) => void;
  onNodeFocus: (id: string | null) => void;
  onEdgeSelect: (id: string | null) => void;
  onCreateEdge: (payload: CreateEdgePayload) => Promise<CanvasEdge>;
  onGroupDrop: (params: { activeNodeId: string; targetNodeId: string | null }) => Promise<void>;
}

const CONNECTION_COLORS: Record<ConnectionType, string> = {
  causes: "#ef4444",
  influences: "#f97316",
  supports: "#22c55e",
  contradicts: "#dc2626",
  related_to: "#6b7280",
};

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

function buildFlowNodes(
  nodes: CanvasNode[],
  selectedNodeIds: string[],
  aiGeneratedGroupIds: Set<string>
): Node[] {
  const selectedSet = new Set(selectedNodeIds);
  const labelsById = new Map(nodes.map((node) => [node.id, node.label] as const));

  const themeNodes = nodes
    .filter((node) => node.type === "theme")
    .map((node) => {
      const previewLabels = node.memberIds
        .slice(0, 4)
        .map((memberId) => labelsById.get(memberId))
        .filter((label): label is string => Boolean(label));

      return {
        id: node.id,
        type: "canvasNode",
        position: node.position,
        selected: selectedSet.has(node.id),
        draggable: true,
        data: {
          node,
          isNestedInGroup: false,
          memberPreviewLabels: previewLabels,
          aiGenerated: aiGeneratedGroupIds.has(node.id),
        } satisfies CanvasNodeCardData,
      } satisfies Node;
    });

  // All nodes are flat (no parentId nesting). ReactFlow's parent-child position
  // recalculation during drag was expensive. Grouped insights use absolute positions
  // and rely on visual styling (left border accent) to show group membership.
  const insightNodes = nodes
    .filter((node) => node.type === "insight")
    .map((node) => ({
      id: node.id,
      type: "canvasNode",
      position: node.position,
      selected: selectedSet.has(node.id),
      draggable: true,
      data: {
        node,
        isNestedInGroup: Boolean(node.groupId),
        memberPreviewLabels: [],
      } satisfies CanvasNodeCardData,
    } satisfies Node));

  return [...themeNodes, ...insightNodes];
}

function buildFlowEdges(
  edges: CanvasEdge[],
  selectedEdgeId: string | null
): Edge[] {
  // Edge labels are now plain strings, not JSX buttons. This eliminates React
  // reconciliation overhead per edge and allows edge selection via handleEdgeClick.
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.source_node_id,
    target: edge.target_node_id,
    label: CONNECTION_TYPE_LABELS[edge.connection_type],
    animated: selectedEdgeId === edge.id,
    style: edgeStyle(edge.connection_type),
    labelStyle: {
      fontSize: 11,
    },
  }));
}

function CanvasGraphInner({
  roundId,
  filters,
  selectedNodeIds,
  selectedEdgeId,
  aiGeneratedGroupIds = new Set(),
  onSelectionChange,
  onNodeFocus,
  onEdgeSelect,
  onCreateEdge,
  onGroupDrop,
}: CanvasGraphProps) {
  const { data, isLoading } = useCanvas(roundId);
  const saveLayout = useSaveLayout(roundId);
  const { getViewport, getIntersectingNodes } = useReactFlow();
  const dragRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragSelectionRef = useRef(false);
  // Suppresses handleSelectionChange while a node-click is being processed
  // so we don't get a double-update cycle (click handler + ReactFlow's own
  // onSelectionChange both calling the same parent state setters).
  const clickHandlingRef = useRef(false);

  // Refs for stable callbacks during drag/click — avoid recreating handlers
  // on every selection change, which caused dependency array bloat and performance issues
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

  const flowNodes = useMemo(
    () => buildFlowNodes(filteredNodes, selectedNodeIds, aiGeneratedGroupIds),
    [filteredNodes, selectedNodeIds, aiGeneratedGroupIds]
  );

  const flowEdges = useMemo(
    () => buildFlowEdges(filteredEdges, selectedEdgeId),
    [filteredEdges, selectedEdgeId]
  );

  const handleNodeClick: NodeMouseHandler = useCallback(
    (event, node) => {
      event.preventDefault();
      clickHandlingRef.current = true;
      const isMultiToggle = event.metaKey || event.ctrlKey || event.shiftKey;
      if (isMultiToggle) {
        // Multi-select: toggle this node in the selection set but don't focus
        // (focusing would hide the multi-select action panel).
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
      // Reset after React has flushed this update so handleSelectionChange
      // (fired by ReactFlow in the same tick) is suppressed.
      Promise.resolve().then(() => { clickHandlingRef.current = false; });
    },
    [onEdgeSelect, onNodeFocus, onSelectionChange]
  );

  const handleSelectionChange = useCallback<OnSelectionChangeFunc>(
    ({ nodes }) => {
      // Suppress during active click or drag — those handlers call the same
      // parent setters directly, so firing again causes a cascade.
      if (dragSelectionRef.current || clickHandlingRef.current) {
        return;
      }
      if (nodes.length === 0) {
        return;
      }
      onSelectionChange(nodes.map((node) => node.id));
      onNodeFocus(nodes[nodes.length - 1]?.id ?? null);
      // Do NOT call onEdgeSelect here — it's set by handleNodeClick /
      // handlePaneClick and calling it here causes extra update cycles.
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
    },
    [nodesById, onCreateEdge, onEdgeSelect, onNodeFocus, onSelectionChange]
  );

  const persistLayout = useCallback(
    (allNodes: Node[]) => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = setTimeout(() => {
        const positions = Object.fromEntries(
          allNodes
            .map((node) => {
              const original = nodesById.get(node.id);
              return original
                ? [
                    node.id,
                    {
                      nodeType: original.type,
                      x: node.position.x,
                      y: node.position.y,
                    },
                  ]
                : null;
            })
            .filter(Boolean) as Array<[string, { nodeType: CanvasNode["type"]; x: number; y: number }]>
        );

        saveLayout.mutate({
          positions,
          viewport: getViewport(),
        });
      }, 1500);
    },
    [getViewport, nodesById, saveLayout]
  );

  const handleNodeDragStart: OnNodeDrag = useCallback(
    (_event, node) => {
      dragRef.current = node.id;
      dragSelectionRef.current = true;
    },
    []
  );

  const handleNodeDragStop: OnNodeDrag = useCallback(
    async (_event, node, allNodes) => {
      const draggedNodeId = dragRef.current ?? node.id;
      const intersectingNodeIds = getIntersectingNodes(node)
        .map((candidate) => candidate.id)
        .filter((candidateId) => candidateId !== draggedNodeId);
      const targetNodeId = intersectingNodeIds[0] ?? null;

      const plan = resolveCanvasGroupingPlan({
        activeNodeId: draggedNodeId,
        targetNodeId,
        selectedNodeIds: selectedNodeIdsRef.current,
        nodes: nodesDataRef.current,
      });

      const draggedNode = nodesDataRef.current.find((candidate) => candidate.id === draggedNodeId);

      persistLayout(allNodes);
      dragRef.current = null;
      dragSelectionRef.current = false;

      if (plan.type !== "noop" && targetNodeId) {
        void onGroupDrop({ activeNodeId: draggedNodeId, targetNodeId });
      } else if (draggedNode?.type === "insight" && draggedNode.groupId && !targetNodeId) {
        void onGroupDrop({ activeNodeId: draggedNodeId, targetNodeId: null });
      }
    },
    [getIntersectingNodes, onGroupDrop, persistLayout]
  );

  if (isLoading || !data) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading evidence network…
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={flowNodes}
      edges={flowEdges}
      nodeTypes={nodeTypes}
      defaultViewport={data.viewport}
      onNodeClick={handleNodeClick}
      onEdgeClick={handleEdgeClick}
      onPaneClick={handlePaneClick}
      onSelectionChange={handleSelectionChange}
      onNodeDragStart={handleNodeDragStart}
      onNodeDragStop={handleNodeDragStop}
      onConnect={handleConnect}
      multiSelectionKeyCode={["Meta", "Control", "Shift"]}
      selectionOnDrag={false}
      panOnScroll
      fitView={false}
      minZoom={0.15}
      maxZoom={2}
      defaultEdgeOptions={{
        style: edgeStyle("related_to"),
      }}
    >
      <Background gap={16} size={1} />
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
