"use client";

import { useEffect, useMemo } from "react";
import {
  Background,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "@/components/canvas/canvas-handles.css";

import { canvasFlowNodeTypes } from "@/components/canvas/canvas-flow-node-types";
import { buildFlowEdges, buildFlowNodes } from "@/lib/canvas-flow-builders";
import type { CardDensity } from "@/lib/canvas-card-density";
import type { CanvasEdge, CanvasNode } from "@/types/canvas";

function FitViewOnDataChange({
  nodeCount,
  edgeCount,
}: {
  nodeCount: number;
  edgeCount: number;
}) {
  const { fitView } = useReactFlow();

  useEffect(() => {
    if (nodeCount === 0) return;
    const frame = requestAnimationFrame(() => {
      void fitView({ padding: 0.2, duration: 0, maxZoom: 0.85 });
    });
    return () => cancelAnimationFrame(frame);
  }, [fitView, nodeCount, edgeCount]);

  return null;
}

function CanvasPreviewFlowInner({
  nodes,
  edges,
}: {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}) {
  const flowNodes = useMemo(
    () =>
      buildFlowNodes(nodes, new Set()).map((node) => ({
        ...node,
        draggable: false,
        selectable: false,
        data: {
          ...(node.data as object),
          globalDensity: "compact" satisfies CardDensity,
        },
      })),
    [nodes]
  );
  const flowEdges = useMemo(() => buildFlowEdges(edges), [edges]);

  return (
    <div className="h-[min(360px,50vh)] min-h-[280px] w-full overflow-hidden rounded-md border bg-muted/10">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={canvasFlowNodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        edgesFocusable={false}
        nodesFocusable={false}
        panOnDrag
        panOnScroll
        zoomOnScroll
        zoomOnPinch
        fitView={false}
        minZoom={0.08}
        maxZoom={1.25}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{
          style: { strokeWidth: 2 },
        }}
      >
        <Background gap={16} size={1} />
        <FitViewOnDataChange nodeCount={flowNodes.length} edgeCount={flowEdges.length} />
      </ReactFlow>
    </div>
  );
}

export function CanvasPreviewFlow({
  nodes,
  edges,
}: {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}) {
  return (
    <ReactFlowProvider>
      <CanvasPreviewFlowInner nodes={nodes} edges={edges} />
    </ReactFlowProvider>
  );
}
