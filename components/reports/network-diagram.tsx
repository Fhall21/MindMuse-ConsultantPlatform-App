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
  type ReportGraphFrameModel,
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

/**
 * Read saved canvas positions from the snapshot's layoutState. Returns null
 * when no node-level positions are present (legacy snapshots), in which case
 * the diagram falls back to dagre auto-layout.
 *
 * Sprint 16 task 03.5 — preserves the consultant's spatial arrangement.
 */
function readSavedPositions(
  graphModel: ReportGraphModel
): Map<string, { x: number; y: number }> | null {
  const entries = graphModel.snapshot.layoutState.filter(
    (entry) => entry.nodeType !== "viewport" && entry.posX !== null && entry.posY !== null
  );
  if (entries.length === 0) return null;
  const positions = new Map<string, { x: number; y: number }>();
  for (const entry of entries) {
    if (entry.posX === null || entry.posY === null) continue;
    positions.set(nodeKey(entry.nodeType as GraphNodeType, entry.nodeId), {
      x: entry.posX,
      y: entry.posY,
    });
  }
  return positions.size > 0 ? positions : null;
}

export function buildNetworkDiagramElements(graphModel: ReportGraphModel): {
  nodes: Node[];
  edges: Edge[];
} {
  const nodeMap = new Map(graphModel.nodes.map((node) => [node.key, node]));
  const savedPositions = readSavedPositions(graphModel);

  // Layout source: prefer the consultant's saved canvas positions; fall
  // back to dagre when no positions were captured (legacy snapshots).
  const positionByKey = new Map<string, { x: number; y: number }>();
  if (savedPositions) {
    for (const node of graphModel.nodes) {
      const saved = savedPositions.get(node.key);
      if (saved) positionByKey.set(node.key, saved);
    }
    // Any nodes without saved positions get a sensible offset so they don't
    // pile on top of each other at the origin.
    let fallbackY = 0;
    for (const node of graphModel.nodes) {
      if (positionByKey.has(node.key)) continue;
      positionByKey.set(node.key, { x: -360, y: fallbackY });
      fallbackY += 120;
    }
  } else {
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
    graphModel.nodes.forEach((node) => {
      const { width, height } = NODE_DIMENSIONS[node.nodeType];
      dagreGraph.setNode(node.key, { width, height });
    });
    graphModel.snapshot.edges.forEach((edge) => {
      const source = nodeKey(edge.fromNodeType, edge.fromNodeId);
      const target = nodeKey(edge.toNodeType, edge.toNodeId);
      if (!nodeMap.has(source) || !nodeMap.has(target)) return;
      dagreGraph.setEdge(source, target);
    });
    dagre.layout(dagreGraph);
    for (const node of graphModel.nodes) {
      const { width, height } = NODE_DIMENSIONS[node.nodeType];
      const positioned = dagreGraph.node(node.key) ?? { x: width / 2, y: height / 2 };
      positionByKey.set(node.key, {
        x: positioned.x - width / 2,
        y: positioned.y - height / 2,
      });
    }
  }

  const nodes: Node[] = graphModel.nodes.map((node) => {
    const palette = NODE_PALETTE[node.nodeType];
    const { width, height } = NODE_DIMENSIONS[node.nodeType];
    const position = positionByKey.get(node.key) ?? { x: 0, y: 0 };

    return {
      id: node.key,
      position,
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

      // Show the consultant's note alongside the connection type so the
      // intent behind the relationship is preserved in the report. Sprint
      // 16 task 03.5. Truncate long notes — the diagram label has limited
      // visual budget; full text is in the connection list view below.
      const typeLabel = formatConnectionTypeLabel(edge.connectionType);
      const note = edge.notes?.trim();
      const labelText =
        note && note.length > 0
          ? `${typeLabel} · ${note.length > 40 ? note.slice(0, 38).trimEnd() + "…" : note}`
          : typeLabel;

      const flowEdge: Edge = {
        id: edge.connectionId,
        source,
        target,
        type: "smoothstep",
        label: labelText,
        // Hover the edge label in the live ReactFlow renderer to see the
        // full note (used by both screen-reader users and consultants
        // checking truncated detail).
        ariaLabel: note ? `${typeLabel} — ${note}` : typeLabel,
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

// ─── Server-rendered imagery ──────────────────────────────────────────────────

interface EvidenceNetworkImageProps {
  canvasImage:
    | { full: string | null; frames: Record<string, string> }
    | null
    | undefined;
  graphFrameModels: ReportGraphFrameModel[];
}

/**
 * Renders the server-captured canvas image(s) inside the Evidence Network
 * section. Shows the full-graph hero image followed by per-frame breakdowns.
 * Returns null when no server imagery is available (caller handles fallback).
 */
export function EvidenceNetworkImageSection({
  canvasImage,
  graphFrameModels,
}: EvidenceNetworkImageProps) {
  const hasFrameImages =
    canvasImage?.frames && Object.keys(canvasImage.frames).length > 0;

  if (!canvasImage?.full && !hasFrameImages) return null;

  return (
    <div className="space-y-6">
      {canvasImage?.full && (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-slate-50/50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={canvasImage.full}
            alt="Full evidence network canvas"
            className="block h-auto w-full"
          />
        </div>
      )}

      {hasFrameImages && graphFrameModels.length > 0 && (
        <div className="space-y-4">
          {graphFrameModels.map((frame) => {
            const img = canvasImage?.frames?.[frame.id];
            if (!img) return null;
            return (
              <div key={frame.id} className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {frame.name}
                </h4>
                <div className="overflow-hidden rounded-xl border border-border/60 bg-slate-50/50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img}
                    alt={`Canvas frame: ${frame.name}`}
                    className="block h-auto w-full"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}