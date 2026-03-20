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
  consultationId: string;
  filters: CanvasFilterState;
  selectedNodeIds: string[];
  selectedEdgeId: string | null;
  onSelectionChange: (nodeIds: string[]) => void;
  onNodeFocus: (id: string | null) => void;
  onEdgeSelect: (id: string | null) => void;
  onCreateEdge: (payload: CreateEdgePayload) => Promise<CanvasEdge>;
  onQuickEditEdge: (edgeId: string) => void;
  onGroupDrop: (params: { activeNodeId: string; targetNodeId: string }) => Promise<void>;
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

function buildFlowNodes(nodes: CanvasNode[], selectedNodeIds: string[]): Node[] {
  const selectedSet = new Set(selectedNodeIds);
  return nodes.map((node) => ({
    id: node.id,
    type: "canvasNode",
    position: node.position,
    selected: selectedSet.has(node.id),
    draggable: true,
      data: {
        node,
        selectionCount: selectedSet.size,
      } satisfies CanvasNodeCardData,
    }));
}

function buildFlowEdges(
  edges: CanvasEdge[],
  selectedEdgeId: string | null,
  onQuickEditEdge: (edgeId: string) => void
): Edge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.source_node_id,
    target: edge.target_node_id,
    label: (
      <button
        type="button"
        className="rounded-full border bg-background px-2 py-1 text-[10px] font-medium shadow-sm"
        onClick={(event) => {
          event.stopPropagation();
          onQuickEditEdge(edge.id);
        }}
      >
        {CONNECTION_TYPE_LABELS[edge.connection_type]}
      </button>
    ),
    animated: selectedEdgeId === edge.id,
    style: edgeStyle(edge.connection_type),
    labelStyle: {
      fontSize: 11,
    },
  }));
}

function CanvasGraphInner({
  consultationId,
  filters,
  selectedNodeIds,
  selectedEdgeId,
  onSelectionChange,
  onNodeFocus,
  onEdgeSelect,
  onCreateEdge,
  onQuickEditEdge,
  onGroupDrop,
}: CanvasGraphProps) {
  const { data, isLoading } = useCanvas(consultationId);
  const saveLayout = useSaveLayout(consultationId);
  const { getViewport, getIntersectingNodes } = useReactFlow();
  const dragRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const nodesById = useMemo(
    () => new Map((data?.nodes ?? []).map((node) => [node.id, node] as const)),
    [data?.nodes]
  );

  const { filteredNodes, filteredEdges } = useMemo(
    () => applyFilters(data?.nodes ?? [], data?.edges ?? [], filters),
    [data?.nodes, data?.edges, filters]
  );

  const flowNodes = useMemo(
    () => buildFlowNodes(filteredNodes, selectedNodeIds),
    [filteredNodes, selectedNodeIds]
  );

  const flowEdges = useMemo(
    () => buildFlowEdges(filteredEdges, selectedEdgeId, onQuickEditEdge),
    [filteredEdges, onQuickEditEdge, selectedEdgeId]
  );

  const handleNodeClick: NodeMouseHandler = useCallback(
    (event, node) => {
      event.preventDefault();
      const isMultiToggle = event.metaKey || event.ctrlKey || event.shiftKey;
      if (isMultiToggle) {
        const next = new Set(selectedNodeIds);
        if (next.has(node.id)) {
          next.delete(node.id);
        } else {
          next.add(node.id);
        }
        onSelectionChange(Array.from(next));
      } else {
        onSelectionChange([node.id]);
      }
      onNodeFocus(node.id);
      onEdgeSelect(null);
    },
    [onEdgeSelect, onNodeFocus, onSelectionChange, selectedNodeIds]
  );

  const handleSelectionChange = useCallback<OnSelectionChangeFunc>(
    ({ nodes }) => {
      if (nodes.length === 0) {
        return;
      }
      onSelectionChange(nodes.map((node) => node.id));
      onNodeFocus(nodes[nodes.length - 1]?.id ?? null);
      onEdgeSelect(null);
    },
    [onEdgeSelect, onNodeFocus, onSelectionChange]
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
      }, 120);
    },
    [getViewport, nodesById, saveLayout]
  );

  const handleNodeDragStart: OnNodeDrag = useCallback(
    (_event, node) => {
      dragRef.current = node.id;
    },
    []
  );

  const handleNodeDragStop: OnNodeDrag = useCallback(
    async (_event, node, allNodes) => {
      const draggedNodeId = dragRef.current ?? node.id;
      const plan = resolveCanvasGroupingPlan({
        activeNodeId: draggedNodeId,
        targetNodeId:
          getIntersectingNodes(node)
            .map((candidate) => candidate.id)
            .find((candidateId) => candidateId !== draggedNodeId) ?? null,
        selectedNodeIds,
        nodes: data?.nodes ?? [],
      });

      persistLayout(allNodes);
      dragRef.current = null;

      if (plan.type !== "noop") {
        const targetNodeId =
          getIntersectingNodes(node)
            .map((candidate) => candidate.id)
            .find((candidateId) => candidateId !== draggedNodeId) ?? null;
        if (targetNodeId) {
          await onGroupDrop({ activeNodeId: draggedNodeId, targetNodeId });
        }
      }
    },
    [data?.nodes, getIntersectingNodes, onGroupDrop, persistLayout, selectedNodeIds]
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
