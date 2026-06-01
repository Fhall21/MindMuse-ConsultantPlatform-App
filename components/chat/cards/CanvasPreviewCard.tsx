"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatToolCardShell } from "./chat-tool-card-shell";
import { readCanvasLayoutPreview, type ChatCardProps } from "./types";

function CanvasThumbnail({
  nodes,
  edges,
}: {
  nodes: Array<{ id: string; x: number; y: number; type: string }>;
  edges: Array<{ from: string; to: string }>;
}) {
  const bounds = useMemo(() => {
    if (nodes.length === 0) {
      return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    }
    const xs = nodes.map((node) => node.x);
    const ys = nodes.map((node) => node.y);
    return {
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys),
    };
  }, [nodes]);

  const width = Math.max(bounds.maxX - bounds.minX, 120);
  const height = Math.max(bounds.maxY - bounds.minY, 80);
  const padding = 24;

  function project(x: number, y: number) {
    const sx = padding + ((x - bounds.minX) / width) * (320 - padding * 2);
    const sy = padding + ((y - bounds.minY) / height) * (180 - padding * 2);
    return { x: sx, y: sy };
  }

  const nodePositions = new Map(
    nodes.map((node) => [node.id, project(node.x, node.y)] as const)
  );

  return (
    <svg
      viewBox="0 0 320 180"
      className="h-44 w-full rounded-md border bg-muted/20"
      role="img"
      aria-label="Canvas layout preview"
    >
      {edges.map((edge) => {
        const from = nodePositions.get(edge.from);
        const to = nodePositions.get(edge.to);
        if (!from || !to) return null;
        return (
          <line
            key={`${edge.from}-${edge.to}`}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke="currentColor"
            strokeOpacity={0.25}
            strokeWidth={1.5}
          />
        );
      })}
      {nodes.map((node) => {
        const point = nodePositions.get(node.id);
        if (!point) return null;
        const radius = node.type === "theme" ? 7 : 5;
        return (
          <circle
            key={node.id}
            cx={point.x}
            cy={point.y}
            r={radius}
            className={node.type === "theme" ? "fill-primary/70" : "fill-muted-foreground/60"}
          />
        );
      })}
    </svg>
  );
}

export function CanvasPreviewCard({ tool }: ChatCardProps) {
  const layout = useMemo(() => readCanvasLayoutPreview(tool.output), [tool.output]);

  if (!layout) {
    return (
      <ChatToolCardShell
        title="Canvas preview unavailable"
        description="Canvas preview available after grouping."
      />
    );
  }

  const canvasHref = `/canvas/round/${layout.consultation_id}?tab=canvas`;

  return (
    <ChatToolCardShell
      maxWidth="2xl"
      title="Canvas preview"
      description={`${layout.node_count} nodes · ${layout.group_count} groups`}
      footer={
        <Button asChild variant="outline" size="sm">
          <Link href={canvasHref}>
            Open full canvas
            <ExternalLink className="size-4" />
          </Link>
        </Button>
      }
    >
      {layout.nodes.length > 0 ? (
        <CanvasThumbnail nodes={layout.nodes} edges={layout.edges} />
      ) : (
        <p className="text-sm text-muted-foreground">
          No canvas nodes yet. Group themes or add insights to populate the canvas.
        </p>
      )}
    </ChatToolCardShell>
  );
}
