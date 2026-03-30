"use client";

import React from "react";
import dagre from "dagre";
import {
  Background,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { GraphNodeType } from "@/lib/graph/types";
import {
  formatConnectionTypeLabel,
  type ReportGraphModel,
} from "@/lib/report-graph";

const MAX_DIAGRAM_NODES = 15;

type DiagramMode = "empty" | "diagram" | "list";

const NODE_DIMENSIONS: Record<GraphNodeType, { width: number; height: number }> = {
  group: { width: 260, height: 96 },
  insight: { width: 240, height: 88 },
  person: { width: 220, height: 84 },
  theme: { width: 240, height: 88 },
};

const NODE_PALETTE: Record<
  GraphNodeType,
  { accent: string; background: string; border: string; label: string }
> = {
  group: {
    accent: "#7c3aed",
    background: "#f5f3ff",
    border: "#c4b5fd",
    label: "Group Theme",
  },
  insight: {
    accent: "#059669",
    background: "#ecfdf5",
    border: "#86efac",
    label: "Supporting Theme",
  },
  person: {
    accent: "#0284c7",
    background: "#eff6ff",
    border: "#93c5fd",
    label: "Person",
  },
  theme: {
    accent: "#059669",
    background: "#ecfdf5",
    border: "#86efac",
    label: "Supporting Theme",
  },
};

function nodeKey(nodeType: GraphNodeType, nodeId: string) {
  return `${nodeType}:${nodeId}`;
}

export function getNetworkDiagramMode(graphModel: ReportGraphModel): DiagramMode {
  if (graphModel.connectionCount === 0) {
    return "empty";
  }

  if (graphModel.nodeCount > MAX_DIAGRAM_NODES) {
    return "list";
  }

  return "diagram";
}

export function buildNetworkDiagramElements(graphModel: ReportGraphModel): {
  nodes: Node[];
  edges: Edge[];
} {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: "LR",
    align: "UL",
    nodesep: 80,
    ranksep: 100,
    marginx: 24,
    marginy: 24,
  });

  const nodeMap = new Map(graphModel.nodes.map((node) => [node.key, node]));

  graphModel.nodes.forEach((node) => {
    const { width, height } = NODE_DIMENSIONS[node.nodeType];
    dagreGraph.setNode(node.key, { width, height });
  });

  graphModel.snapshot.edges.forEach((edge) => {
    const source = nodeKey(edge.fromNodeType, edge.fromNodeId);
    const target = nodeKey(edge.toNodeType, edge.toNodeId);

    if (!nodeMap.has(source) || !nodeMap.has(target)) {
      return;
    }

    dagreGraph.setEdge(source, target);
  });

  dagre.layout(dagreGraph);

  const nodes: Node[] = graphModel.nodes.map((node) => {
    const palette = NODE_PALETTE[node.nodeType];
    const { width, height } = NODE_DIMENSIONS[node.nodeType];
    const positioned = dagreGraph.node(node.key) ?? { x: width / 2, y: height / 2 };

    return {
      id: node.key,
      position: {
        x: positioned.x - width / 2,
        y: positioned.y - height / 2,
      },
      draggable: false,
      selectable: false,
      data: {
        label: (
          <div className="space-y-2 text-left">
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-semibold leading-tight text-slate-950">
                {node.label}
              </span>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em]"
                style={{
                  color: palette.accent,
                  backgroundColor: "rgba(255,255,255,0.72)",
                }}
              >
                {palette.label}
              </span>
            </div>
            {node.consultationTitle ? (
              <div className="text-xs font-medium text-slate-600">{node.consultationTitle}</div>
            ) : null}
            {node.description ? (
              <div className="text-xs leading-relaxed text-slate-600">{node.description}</div>
            ) : null}
          </div>
        ),
      },
      style: {
        width,
        minHeight: height,
        borderRadius: 18,
        border: `1px solid ${palette.border}`,
        borderLeft: `6px solid ${palette.accent}`,
        background: palette.background,
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
        padding: 14,
      },
    };
  });

  const edges = graphModel.snapshot.edges
    .map((edge): Edge | null => {
      const source = nodeKey(edge.fromNodeType, edge.fromNodeId);
      const target = nodeKey(edge.toNodeType, edge.toNodeId);

      if (!nodeMap.has(source) || !nodeMap.has(target)) {
        return null;
      }

      const flowEdge: Edge = {
        id: edge.connectionId,
        source,
        target,
        type: "smoothstep",
        label: formatConnectionTypeLabel(edge.connectionType),
        labelShowBg: true,
        labelBgPadding: [8, 4],
        labelBgBorderRadius: 999,
        labelBgStyle: {
          fill: "#ffffff",
          fillOpacity: 0.95,
          stroke: "#cbd5e1",
        },
        labelStyle: {
          fill: "#334155",
          fontSize: 11,
          fontWeight: 700,
        },
        style: {
          stroke: "#94a3b8",
          strokeWidth: 1.6,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 18,
          height: 18,
          color: "#94a3b8",
        },
        selectable: false,
        focusable: false,
      };

      return flowEdge;
    })
    .filter((value): value is Edge => value !== null);

  return { nodes, edges };
}

function CompactConnectionList({ graphModel }: { graphModel: ReportGraphModel }) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-amber-200/70 bg-amber-50/70 px-4 py-3 text-sm text-amber-950">
        Compact grouped list shown because this network has {graphModel.nodeCount} nodes. The
        diagram view is intentionally disabled above {MAX_DIAGRAM_NODES} nodes to avoid overlap
        and unreadable edge labels.
      </div>
      {graphModel.connectionsByType.map((group) => (
        <div key={group.type} className="rounded-xl border border-border/60 bg-muted/5 px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold text-foreground">{group.label}</h4>
            <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {group.connections.length}
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {group.connections.map((connection) => (
              <div
                key={connection.key}
                className="rounded-lg border border-border/50 bg-background px-3 py-3"
              >
                <div className="text-sm font-medium text-foreground">
                  {connection.fromLabel}
                  <span className="mx-2 text-muted-foreground">→</span>
                  {connection.toLabel}
                </div>
                <div className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {formatConnectionTypeLabel(connection.connectionType)}
                </div>
                {connection.notes ? (
                  <div className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {connection.notes}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function NetworkDiagram({ graphModel }: { graphModel: ReportGraphModel }) {
  const mode = getNetworkDiagramMode(graphModel);

  if (mode === "empty") {
    return (
      <div className="rounded-xl border border-dashed border-border/60 bg-muted/5 px-4 py-6 text-sm text-muted-foreground">
        No saved typed connections were available on this artifact. The snapshot preserves the
        network nodes, but there is no relationship map to render yet.
      </div>
    );
  }

  if (mode === "list") {
    return <CompactConnectionList graphModel={graphModel} />;
  }

  const { nodes, edges } = buildNetworkDiagramElements(graphModel);

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-slate-50/70">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/50 px-4 py-3 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Static snapshot</span>
        <span>•</span>
        <span>dagre auto-layout</span>
        <span>•</span>
        <span>read-only</span>
      </div>
      <div className="h-[620px] w-full" data-testid="network-diagram-canvas">
        <ReactFlowProvider>
          <ReactFlow
            aria-label="Evidence network diagram"
            nodes={nodes}
            edges={edges}
            fitView
            fitViewOptions={{ padding: 0.18 }}
            proOptions={{ hideAttribution: true }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            panOnDrag={false}
            panOnScroll={false}
            zoomOnDoubleClick={false}
            zoomOnPinch={false}
            zoomOnScroll={false}
            preventScrolling={false}
            nodesFocusable={false}
            edgesFocusable={false}
            minZoom={0.4}
            maxZoom={1.1}
          >
            <Background gap={24} size={1} color="#dbe4f0" />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
    </div>
  );
}