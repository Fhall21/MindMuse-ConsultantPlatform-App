"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CanvasPreviewFlow } from "@/components/canvas/canvas-preview-flow";
import { ChatToolCardShell } from "./chat-tool-card-shell";
import { readCanvasLayoutPreview, type ChatCardProps } from "./types";

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
      {layout.canvas_nodes.length > 0 ? (
        <CanvasPreviewFlow nodes={layout.canvas_nodes} edges={layout.canvas_edges} />
      ) : (
        <p className="text-sm text-muted-foreground">
          No canvas nodes yet. Group themes or add insights to populate the canvas.
        </p>
      )}
    </ChatToolCardShell>
  );
}
