"use client";

import { useCallback, useRef } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  type Node,
  type Edge,
  type NodeMouseHandler,
  type EdgeMouseHandler,
  type OnNodeDrag,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useCanvas, useSaveLayout } from "@/hooks/use-canvas";
import type { CanvasFilterState, CanvasNode, CanvasEdge, ConnectionType } from "@/types/canvas";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CanvasGraphProps {
  consultationId: string;
  filters: CanvasFilterState;
  onNodeSelect: (id: string | null) => void;
  onEdgeSelect: (id: string | null) => void;
}

// ---------------------------------------------------------------------------
// Styling helpers
// ---------------------------------------------------------------------------

const CONNECTION_COLORS: Record<ConnectionType, string> = {
  causes: "#ef4444",
  influences: "#f97316",
  supports: "#22c55e",
  contradicts: "#ef4444",
  related_to: "#6b7280",
};

function edgeStyle(connectionType: ConnectionType) {
  const color = CONNECTION_COLORS[connectionType];
  const isDashed = connectionType === "contradicts";
  return {
    stroke: color,
    strokeWidth: 2,
    strokeDasharray: isDashed ? "6 3" : undefined,
  };
}

function nodeStyle(type: CanvasNode["type"], accepted: boolean) {
  const isTheme = type === "theme";
  return {
    background: isTheme ? "hsl(210 40% 96%)" : "hsl(142 40% 96%)",
    border: `2px ${accepted ? "solid" : "dashed"} ${isTheme ? "#3b82f6" : "#22c55e"}`,
    borderRadius: "8px",
    padding: "8px 12px",
    minWidth: "120px",
    fontSize: "12px",
    color: "hsl(222.2 84% 4.9%)",
  };
}

// ---------------------------------------------------------------------------
// Data mapping helpers
// ---------------------------------------------------------------------------

function toFlowNode(node: CanvasNode): Node {
  return {
    id: node.id,
    type: "default",
    position: node.position,
    data: {
      label: (
        <div>
          <div style={{ fontWeight: 600 }}>{node.label}</div>
          {node.description && (
            <div style={{ opacity: 0.7, fontSize: "11px", marginTop: 2 }}>
              {node.description}
            </div>
          )}
        </div>
      ),
      _type: node.type,
      _accepted: node.accepted,
    },
    style: nodeStyle(node.type, node.accepted),
  };
}

function toFlowEdge(edge: CanvasEdge): Edge {
  return {
    id: edge.id,
    source: edge.source_node_id,
    target: edge.target_node_id,
    label: edge.connection_type.replace(/_/g, " "),
    style: edgeStyle(edge.connection_type),
    labelStyle: { fontSize: 11, fill: CONNECTION_COLORS[edge.connection_type] },
    data: { _connectionType: edge.connection_type },
  };
}

// ---------------------------------------------------------------------------
// Filter helpers
// ---------------------------------------------------------------------------

function applyFilters(
  nodes: CanvasNode[],
  edges: CanvasEdge[],
  filters: CanvasFilterState
): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
  const query = filters.searchQuery.trim().toLowerCase();

  const filteredNodes = nodes.filter((n) => {
    if (!filters.nodeTypes.includes(n.type)) return false;
    if (filters.acceptedOnly && !n.accepted) return false;
    if (query && !n.label.toLowerCase().includes(query)) return false;
    return true;
  });

  const visibleNodeIds = new Set(filteredNodes.map((n) => n.id));

  const filteredEdges = edges.filter(
    (e) =>
      filters.connectionTypes.includes(e.connection_type) &&
      visibleNodeIds.has(e.source_node_id) &&
      visibleNodeIds.has(e.target_node_id)
  );

  return { nodes: filteredNodes, edges: filteredEdges };
}

// ---------------------------------------------------------------------------
// Inner graph (needs ReactFlowProvider context for useReactFlow)
// ---------------------------------------------------------------------------

function CanvasGraphInner({
  consultationId,
  filters,
  onNodeSelect,
  onEdgeSelect,
}: CanvasGraphProps) {
  const { data, isLoading } = useCanvas(consultationId);
  const saveLayout = useSaveLayout(consultationId);
  const { getViewport } = useReactFlow();

  // Debounce timer ref for layout save
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleNodeDragStop: OnNodeDrag = useCallback(
    (_event, _node, allNodes) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const positions: Record<string, { x: number; y: number }> = {};
        for (const n of allNodes) {
          positions[n.id] = { x: n.position.x, y: n.position.y };
        }
        saveLayout.mutate({ positions, viewport: getViewport() });
      }, 1000);
    },
    [saveLayout, getViewport]
  );

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      onNodeSelect(node.id);
    },
    [onNodeSelect]
  );

  const handleEdgeClick: EdgeMouseHandler = useCallback(
    (_event, edge) => {
      onEdgeSelect(edge.id);
    },
    [onEdgeSelect]
  );

  const handlePaneClick = useCallback(() => {
    onNodeSelect(null);
    onEdgeSelect(null);
  }, [onNodeSelect, onEdgeSelect]);

  if (isLoading || !data) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading evidence network…
      </div>
    );
  }

  const { nodes: filteredNodes, edges: filteredEdges } = applyFilters(
    data.nodes,
    data.edges,
    filters
  );

  const flowNodes = filteredNodes.map(toFlowNode);
  const flowEdges = filteredEdges.map(toFlowEdge);

  const defaultViewport = {
    x: data.viewport.x,
    y: data.viewport.y,
    zoom: data.viewport.zoom,
  };

  return (
    <ReactFlow
      nodes={flowNodes}
      edges={flowEdges}
      defaultViewport={defaultViewport}
      onNodeClick={handleNodeClick}
      onEdgeClick={handleEdgeClick}
      onPaneClick={handlePaneClick}
      onNodeDragStop={handleNodeDragStop}
      fitView={flowNodes.length > 0}
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.1}
      maxZoom={2}
    >
      <Background gap={16} size={1} />
      <Controls />
      <MiniMap nodeStrokeWidth={3} zoomable pannable />
    </ReactFlow>
  );
}

// ---------------------------------------------------------------------------
// Exported component — wraps with ReactFlowProvider
// ---------------------------------------------------------------------------

export function CanvasGraph(props: CanvasGraphProps) {
  return (
    <ReactFlowProvider>
      <CanvasGraphInner {...props} />
    </ReactFlowProvider>
  );
}
