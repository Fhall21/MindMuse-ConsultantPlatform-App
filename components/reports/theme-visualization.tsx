"use client";

// ─── Section 2: GroupNetworkSection
// ─── Section 3: CanvasPreviewSection
//
// Both are read-only React Flow diagrams. They are separate from the existing
// NetworkDiagram component which renders the legacy flat Dagre view.
//
// Data flow:
//   graphModel.snapshot.edges  → filter group↔group edges for Section 2
//   graphModel.snapshot.nodes  → all nodes for Section 3
//   graphModel.snapshot.layoutState → node positions (null for legacy snapshots)
//   allGroups (AllThemeGroupSnapshot[]) → membership for Section 3 nested layout
//
// Layout strategy for Section 3:
//   - Group nodes: Dagre auto-layout (groups only) — sizes from member count
//   - Insight nodes: slot positions inside their group (no React Flow parentNode)
//                    absolute position = groupDagrePos + slotOffset
//   - Insight→group "supports" membership edges are filtered out from drawn edges
//     (membership is implied visually by the nested position)

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dagre from "dagre";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MarkerType,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Badge } from "@/components/ui/badge";
import {
  formatConnectionTypeLabel,
  type ReportGraphModel,
  type AllThemeGroupSnapshot,
} from "@/lib/report-graph";
import type { GraphNodeType, ConnectionType } from "@/lib/graph/types";

// ─── Shared palette ───────────────────────────────────────────────────────────

// Connection type colors used in both Section 2 and 3 edges.
// These match the lib/graph/types.ts ConnectionType vocabulary.
const CONNECTION_EDGE_COLORS: Record<string, string> = {
  related_to: "#6b7280",
  supports: "#22c55e",
  contradicts: "#dc2626",
  escalates: "#8b5cf6",
  resolves: "#0ea5e9",
  involves: "#64748b",
  // canvas vocabulary (legacy reports may have these)
  causes: "#ef4444",
  influences: "#f97316",
};

function edgeColor(connectionType: string): string {
  return CONNECTION_EDGE_COLORS[connectionType] ?? "#94a3b8";
}

// ─── Canvas layout constants (mirrored from canvas-graph.tsx) ─────────────────

const GROUP_COLUMNS = 2;
const GROUP_WIDTH = 540; // slightly smaller than canvas to fit report column
const GROUP_HEADER_HEIGHT = 100;
const GROUP_PADDING_X = 24;
const GROUP_PADDING_TOP = 20;
const GROUP_PADDING_BOTTOM = 24;
const GROUP_GAP_X = 20;
const GROUP_GAP_Y = 18;
const INSIGHT_WIDTH = 236;
const INSIGHT_HEIGHT = 100;

function getGroupHeight(memberCount: number): number {
  const visibleCount = Math.max(memberCount, 1);
  const rowCount = Math.max(1, Math.ceil(visibleCount / GROUP_COLUMNS));
  return Math.max(
    220,
    GROUP_HEADER_HEIGHT +
      GROUP_PADDING_TOP +
      GROUP_PADDING_BOTTOM +
      rowCount * INSIGHT_HEIGHT +
      Math.max(0, rowCount - 1) * GROUP_GAP_Y
  );
}

function getSlotPosition(index: number): { x: number; y: number } {
  const row = Math.floor(index / GROUP_COLUMNS);
  const col = index % GROUP_COLUMNS;
  return {
    x: GROUP_PADDING_X + col * (INSIGHT_WIDTH + GROUP_GAP_X),
    y: GROUP_HEADER_HEIGHT + GROUP_PADDING_TOP + row * (INSIGHT_HEIGHT + GROUP_GAP_Y),
  };
}

function nodeKey(nodeType: GraphNodeType | string, nodeId: string): string {
  return `${nodeType}:${nodeId}`;
}

// ─── Lazy mount hook using IntersectionObserver ───────────────────────────────

function useLazyMount(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setMounted(true);
          observer.disconnect();
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, mounted };
}

// ─── Shared edge builder ──────────────────────────────────────────────────────

function buildReportEdge(
  id: string,
  source: string,
  target: string,
  connectionType: string,
  selectedEdgeId?: string | null
): Edge {
  return {
    id,
    source,
    target,
    type: "smoothstep",
    label: formatConnectionTypeLabel(connectionType as ConnectionType),
    animated: selectedEdgeId === id,
    selected: selectedEdgeId === id,
    labelShowBg: true,
    labelBgPadding: [8, 4],
    labelBgBorderRadius: 999,
    labelBgStyle: { fill: "#ffffff", fillOpacity: 0.95, stroke: "#cbd5e1" },
    labelStyle: { fill: edgeColor(connectionType), fontSize: 10, fontWeight: 700 },
    style: { stroke: edgeColor(connectionType), strokeWidth: 1.8 },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 16,
      height: 16,
      color: edgeColor(connectionType),
    },
    selectable: false,
    focusable: false,
  };
}

// ─── Section 2: Group Network ─────────────────────────────────────────────────
//
// Shows only group→group connections. If no group↔group edges exist, returns null.
// This section reveals how accepted themes relate to each other at the aggregate level.
//
// ASCII diagram:
//
//  [Group A] ──causes──▶ [Group B] ──supports──▶ [Group C]
//                              │
//                        contradicts
//                              │
//                              ▼
//                         [Group D]

function buildGroupNetworkElements(graphModel: ReportGraphModel): {
  nodes: Node[];
  edges: Edge[];
} | null {
  const groupEdges = graphModel.snapshot.edges.filter(
    (e) => e.fromNodeType === "group" && e.toNodeType === "group"
  );

  if (groupEdges.length === 0) return null;

  // Collect group node IDs that are actually involved in connections
  const involvedIds = new Set<string>();
  groupEdges.forEach((e) => {
    involvedIds.add(e.fromNodeId);
    involvedIds.add(e.toNodeId);
  });

  const groupNodes = graphModel.groupNodes.filter((n) =>
    involvedIds.has(n.key.split(":")[1] ?? n.key)
  );

  if (groupNodes.length === 0) return null;

  // Dagre layout for groups
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 60, ranksep: 100, marginx: 32, marginy: 32 });

  const NODE_W = 220;
  const NODE_H = 80;

  groupNodes.forEach((n) => {
    g.setNode(n.key, { width: NODE_W, height: NODE_H });
  });

  groupEdges.forEach((e) => {
    const src = nodeKey(e.fromNodeType, e.fromNodeId);
    const tgt = nodeKey(e.toNodeType, e.toNodeId);
    g.setEdge(src, tgt);
  });

  dagre.layout(g);

  const nodes: Node[] = groupNodes.map((n) => {
    const pos = g.node(n.key) ?? { x: NODE_W / 2, y: NODE_H / 2 };
    return {
      id: n.key,
      position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 },
      draggable: false,
      selectable: false,
      data: {
        label: (
          <div className="space-y-1 text-left">
            <p className="text-xs font-semibold leading-tight text-slate-900 line-clamp-2">
              {n.label}
            </p>
            {n.memberCount != null && (
              <p className="text-[10px] text-slate-500">
                {n.memberCount} insight{n.memberCount === 1 ? "" : "s"}
              </p>
            )}
          </div>
        ),
      },
      style: {
        width: NODE_W,
        minHeight: NODE_H,
        borderRadius: 14,
        border: "1px solid #c4b5fd",
        borderLeft: "5px solid #7c3aed",
        background: "#f5f3ff",
        boxShadow: "0 4px 16px rgba(124, 58, 237, 0.08)",
        padding: "10px 14px",
      },
    };
  });

  const edges: Edge[] = groupEdges.map((e) =>
    buildReportEdge(
      e.connectionId,
      nodeKey(e.fromNodeType, e.fromNodeId),
      nodeKey(e.toNodeType, e.toNodeId),
      e.connectionType
    )
  );

  return { nodes, edges };
}

function GroupNetworkInner({ graphModel }: { graphModel: ReportGraphModel }) {
  const elements = useMemo(() => buildGroupNetworkElements(graphModel), [graphModel]);

  if (!elements) return null;

  return (
    <section className="space-y-3 print:hidden">
      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Group Connections ({graphModel.snapshot.edges.filter((e) => e.fromNodeType === "group" && e.toNodeType === "group").length})
        </h3>
        <p className="text-xs text-muted-foreground">
          How accepted themes relate to each other at the group level.
        </p>
      </div>
      <div className="overflow-hidden rounded-xl border border-border/50 bg-muted/5" style={{ height: 300 }}>
        <ReactFlow
          nodes={elements.nodes}
          edges={elements.edges}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag={true}
          zoomOnScroll={false}
          zoomOnPinch={true}
          minZoom={0.3}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={24} size={1} color="#e2e8f0" />
          <Controls showInteractive={false} position="bottom-right" />
        </ReactFlow>
      </div>
    </section>
  );
}

export function GroupNetworkSection({ graphModel }: { graphModel: ReportGraphModel }) {
  // Only render if there are group→group connections — don't pay the React Flow
  // mount cost otherwise.
  const hasGroupEdges = graphModel.snapshot.edges.some(
    (e) => e.fromNodeType === "group" && e.toNodeType === "group"
  );
  if (!hasGroupEdges) return null;

  return (
    <ReactFlowProvider>
      <GroupNetworkInner graphModel={graphModel} />
    </ReactFlowProvider>
  );
}

// ─── Section 3: Canvas Preview ────────────────────────────────────────────────
//
// Reconstructs the canvas layout from the frozen snapshot.
// Groups are rendered as wide containers; insights are slotted inside.
// Membership edges (insight→group supports) are hidden from wire drawing.
// Only semantic edges (group↔group, insight↔insight) are drawn.
//
// If layoutState has null positions (legacy snapshots), positions are computed
// via Dagre on groups and slot math on insights.
//
// ASCII diagram (example):
//
//  ┌──────────────────────────────────┐       ┌────────────────────────────────┐
//  │  Group A                         │       │  Group B                       │
//  │ ┌────────────┐  ┌──────────────┐ │       │ ┌────────────┐                │
//  │ │ Insight 1  │  │ Insight 2    │ │──────▶│ │ Insight 3  │                │
//  │ └────────────┘  └──────────────┘ │       │ └────────────┘                │
//  └──────────────────────────────────┘       └────────────────────────────────┘

function buildCanvasPreviewElements(
  graphModel: ReportGraphModel,
  allGroups: AllThemeGroupSnapshot[]
): { nodes: Node[]; edges: Edge[] } {
  const snapshot = graphModel.snapshot;

  // Build membership: insightId → groupId
  const insightGroupMap = new Map<string, string>();
  for (const group of allGroups) {
    for (const member of group.members) {
      insightGroupMap.set(member.insightId, group.id);
    }
  }

  // Build layout positions from layoutState (may be all null for legacy)
  const layoutByKey = new Map<string, { x: number; y: number }>();
  for (const entry of snapshot.layoutState) {
    if ((entry.nodeType as string) !== "viewport" && entry.posX != null && entry.posY != null) {
      layoutByKey.set(nodeKey(entry.nodeType, entry.nodeId), {
        x: entry.posX,
        y: entry.posY,
      });
    }
  }

  const hasRealPositions = layoutByKey.size > 0;

  // Compute group dimensions
  const groupDimensions = new Map<string, { width: number; height: number }>();
  for (const group of allGroups) {
    groupDimensions.set(group.id, {
      width: GROUP_WIDTH,
      height: getGroupHeight(group.members.length),
    });
  }

  // Dagre layout for groups (used when no real positions available)
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 80, ranksep: 120, marginx: 48, marginy: 48 });

  for (const group of allGroups) {
    const dims = groupDimensions.get(group.id)!;
    g.setNode(group.id, { width: dims.width, height: dims.height });
  }

  // Add group→group edges to Dagre for better spacing
  const semanticEdges = snapshot.edges.filter(
    (e) =>
      !(e.fromNodeType === "insight" && e.toNodeType === "group") &&
      !(e.fromNodeType === "group" && e.toNodeType === "insight")
  );

  for (const edge of semanticEdges) {
    if (edge.fromNodeType === "group" && edge.toNodeType === "group") {
      g.setEdge(edge.fromNodeId, edge.toNodeId);
    }
  }

  dagre.layout(g);

  // Group absolute positions
  const groupPositions = new Map<string, { x: number; y: number }>();
  for (const group of allGroups) {
    if (hasRealPositions && layoutByKey.has(nodeKey("group", group.id))) {
      groupPositions.set(group.id, layoutByKey.get(nodeKey("group", group.id))!);
    } else {
      const dagrePos = g.node(group.id);
      const dims = groupDimensions.get(group.id)!;
      groupPositions.set(group.id, {
        x: (dagrePos?.x ?? 0) - dims.width / 2,
        y: (dagrePos?.y ?? 0) - dims.height / 2,
      });
    }
  }

  // Build group React Flow nodes
  const groupFlowNodes: Node[] = allGroups.map((group) => {
    const pos = groupPositions.get(group.id) ?? { x: 0, y: 0 };
    const dims = groupDimensions.get(group.id)!;

    return {
      id: group.id,
      position: pos,
      draggable: false,
      selectable: false,
      zIndex: 0,
      data: {
        label: (
          <div className="px-1">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-sm font-semibold text-slate-900 leading-tight line-clamp-2">
                {group.label}
              </p>
              <span className="shrink-0 rounded-full border border-violet-200 bg-white/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-700">
                {group.members.length} insight{group.members.length === 1 ? "" : "s"}
              </span>
            </div>
            {group.description && (
              <p className="text-[11px] leading-relaxed text-slate-500 line-clamp-2">
                {group.description}
              </p>
            )}
          </div>
        ),
      },
      style: {
        width: dims.width,
        height: dims.height,
        borderRadius: 16,
        border: "1px solid #c4b5fd",
        borderTop: "4px solid #7c3aed",
        background: "rgba(245, 243, 255, 0.6)",
        boxShadow: "0 8px 32px rgba(124, 58, 237, 0.07)",
        padding: "14px 16px 8px",
        pointerEvents: "none",
      },
    };
  });

  // Build insight React Flow nodes
  const insightFlowNodes: Node[] = [];

  for (const group of allGroups) {
    const groupPos = groupPositions.get(group.id) ?? { x: 0, y: 0 };

    const sortedMembers = [...group.members].sort((a, b) => a.position - b.position);

    sortedMembers.forEach((member, index) => {
      let nodePos: { x: number; y: number };

      const layoutPos = hasRealPositions
        ? (layoutByKey.get(nodeKey("insight", member.insightId)) ?? null)
        : null;

      if (layoutPos) {
        nodePos = layoutPos;
      } else {
        const slot = getSlotPosition(index);
        nodePos = { x: groupPos.x + slot.x, y: groupPos.y + slot.y };
      }

      insightFlowNodes.push({
        id: member.insightId,
        position: nodePos,
        draggable: false,
        selectable: false,
        zIndex: 1,
        data: {
          label: (
            <div className="space-y-1 text-left">
              <p className="text-xs font-medium leading-tight text-slate-800 line-clamp-2">
                {member.label}
              </p>
              {member.sourceConsultationTitle && (
                <p className="text-[10px] text-slate-400 line-clamp-1">
                  {member.sourceConsultationTitle}
                </p>
              )}
              {member.isUserAdded && (
                <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-500">
                  Custom
                </span>
              )}
            </div>
          ),
        },
        style: {
          width: INSIGHT_WIDTH,
          minHeight: INSIGHT_HEIGHT,
          borderRadius: 10,
          border: "1px solid #d1fae5",
          borderLeft: "4px solid #10b981",
          background: "#f0fdf4",
          boxShadow: "0 2px 8px rgba(16, 185, 129, 0.07)",
          padding: "8px 12px",
        },
      });
    });
  }

  // Build edges — skip insight→group membership edges
  const flowEdges: Edge[] = semanticEdges
    .map((e): Edge | null => {
      const sourceId =
        e.fromNodeType === "group"
          ? e.fromNodeId
          : nodeKey(e.fromNodeType, e.fromNodeId);
      const targetId =
        e.toNodeType === "group"
          ? e.toNodeId
          : nodeKey(e.toNodeType, e.toNodeId);

      return buildReportEdge(e.connectionId, sourceId, targetId, e.connectionType);
    })
    .filter((e): e is Edge => e !== null);

  // Ungrouped nodes — any snapshot nodes not in allGroups
  const knownNodeIds = new Set<string>([
    ...allGroups.map((g) => g.id),
    ...allGroups.flatMap((g) => g.members.map((m) => m.insightId)),
  ]);

  const ungroupedNodes: Node[] = snapshot.nodes
    .filter(
      (n) =>
        !knownNodeIds.has(n.nodeId) &&
        n.nodeType !== "group"
    )
    .map((n, i) => ({
      id: nodeKey(n.nodeType, n.nodeId),
      position: layoutByKey.get(nodeKey(n.nodeType, n.nodeId)) ?? {
        x: 60 + (i % 3) * 280,
        y: -120 - Math.floor(i / 3) * 120,
      },
      draggable: false,
      selectable: false,
      zIndex: 1,
      data: {
        label: (
          <p className="text-xs font-medium text-slate-800">{n.label}</p>
        ),
      },
      style: {
        width: 200,
        minHeight: 64,
        borderRadius: 10,
        border: "1px solid #e2e8f0",
        borderLeft: "4px solid #94a3b8",
        background: "#f8fafc",
        padding: "8px 12px",
      },
    }));

  return {
    nodes: [...groupFlowNodes, ...insightFlowNodes, ...ungroupedNodes],
    edges: flowEdges,
  };
}

function CanvasPreviewInner({
  graphModel,
  allGroups,
  roundId,
}: {
  graphModel: ReportGraphModel;
  allGroups: AllThemeGroupSnapshot[];
  roundId: string;
}) {
  const { nodes, edges } = useMemo(
    () => buildCanvasPreviewElements(graphModel, allGroups),
    [graphModel, allGroups]
  );

  const hasEdges = edges.length > 0;

  return (
    <div
      className="overflow-hidden rounded-xl border border-border/50 bg-white"
      style={{ height: 560 }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={true}
        panOnScroll={true}
        zoomOnScroll={true}
        zoomOnPinch={true}
        minZoom={0.2}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={28} size={1} color="#e9e6f5" />
        <Controls showInteractive={false} position="bottom-right" />
        {!hasEdges && (
          <div className="absolute bottom-3 left-3 z-10 rounded-lg border border-border/40 bg-white/90 px-3 py-2 text-xs text-muted-foreground backdrop-blur">
            No connections drawn between nodes yet — draw them in the canvas.
          </div>
        )}
      </ReactFlow>
    </div>
  );
}

export function CanvasPreviewSection({
  graphModel,
  allGroups,
  roundId,
}: {
  graphModel: ReportGraphModel;
  allGroups: AllThemeGroupSnapshot[];
  roundId: string;
}) {
  const { ref, mounted } = useLazyMount(0.05);

  const nodeCount = graphModel.snapshot.nodes.length;
  const snapshotDate = graphModel.snapshot.snapshotAt;

  return (
    <section className="space-y-3 print:hidden">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Evidence Canvas
          </h3>
          <p className="text-xs text-muted-foreground">
            Visual snapshot at report generation
            {snapshotDate && (
              <>
                {" "}·{" "}
                {new Date(snapshotDate).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-violet-500" />
            <span className="text-[10px] text-muted-foreground">Group theme</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-[10px] text-muted-foreground">Supporting insight</span>
          </div>
          <Link
            href={`/consultations/rounds/${roundId}/canvas`}
            className="text-[10px] font-medium text-primary underline-offset-2 hover:underline"
          >
            Open live canvas →
          </Link>
        </div>
      </div>

      {nodeCount === 0 ? (
        <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-border/50 text-sm text-muted-foreground">
          No canvas nodes in this snapshot.
        </div>
      ) : (
        <div ref={ref} style={{ minHeight: 560 }}>
          {mounted ? (
            <ReactFlowProvider>
              <CanvasPreviewInner
                graphModel={graphModel}
                allGroups={allGroups}
                roundId={roundId}
              />
            </ReactFlowProvider>
          ) : (
            <div className="flex items-center justify-center rounded-xl border border-border/50 bg-muted/5" style={{ height: 560 }}>
              <p className="text-sm text-muted-foreground">Loading canvas preview…</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
