"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CanvasNode } from "@/types/canvas";

export interface CanvasNodeCardData {
  node: CanvasNode;
  isNestedInGroup: boolean;
  memberPreviewLabels: string[];
  aiGenerated?: boolean;
  containerWidth?: number;
  containerHeight?: number;
}

function InsightCard({
  node,
  isNestedInGroup,
  selected,
}: {
  node: CanvasNode;
  isNestedInGroup: boolean;
  selected: boolean;
}) {
  return (
    <div
      className={cn(
        "group relative h-full w-full rounded-xl border bg-background/95 px-4 py-3 shadow-sm transition-[border-color,box-shadow,transform]",
        "min-h-[56px]",
        isNestedInGroup && "border-violet-200 bg-white/95 dark:border-violet-900 dark:bg-slate-950/95",
        selected && "border-primary ring-2 ring-primary/20 shadow-lg"
      )}
      data-testid="canvas-insight-card"
    >
      <Handle
        id="target"
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !border-2 !border-background !bg-primary"
      />

      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-semibold leading-tight text-foreground line-clamp-2">
            {node.label}
          </p>
          {node.description ? (
            <p className="text-xs leading-5 text-muted-foreground line-clamp-2">
              {node.description}
            </p>
          ) : null}
        </div>
        {node.accepted ? (
          <span
            className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500"
            title="Accepted"
          />
        ) : null}
      </div>

      <div className="mt-3 flex items-center gap-2">
        {node.sourceConsultationTitle ? (
          <Badge
            variant="outline"
            className="max-w-[140px] truncate border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
            title={node.sourceConsultationTitle}
          >
            {node.sourceConsultationTitle}
          </Badge>
        ) : null}
        {node.isUserAdded ? (
          <Badge variant="outline" className="px-2 py-0.5 text-[10px]">
            Manual
          </Badge>
        ) : null}
      </div>

      <Handle
        id="source"
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !border-2 !border-background !bg-primary"
      />
    </div>
  );
}

function ThemeCard({
  node,
  selected,
  aiGenerated,
  dragging,
}: {
  node: CanvasNode;
  selected: boolean;
  aiGenerated?: boolean;
  dragging?: boolean;
}) {
  const memberCount = node.memberIds.length;

  return (
    <div
      className={cn(
        "group relative h-full w-full overflow-hidden rounded-[24px] border bg-card shadow-sm transition-opacity",
        "border-border/80",
        dragging && "opacity-45",
        selected && "border-foreground/20 ring-2 ring-foreground/10 shadow-lg"
      )}
      data-testid="canvas-group-card"
    >
      <div className="absolute inset-y-0 left-0 w-1.5 bg-emerald-500/70" />

      <Handle
        id="target"
        type="target"
        position={Position.Left}
        className="!top-12 !left-3 !h-3 !w-3 !border-2 !border-background !bg-emerald-500"
      />

      <div className="relative flex h-full flex-col">
        <div className="border-b border-border/80 px-7 py-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <p className="text-base font-semibold leading-tight text-foreground line-clamp-2">
                {node.label}
              </p>
              {node.description ? (
                <p className="max-w-[42ch] text-sm leading-6 text-muted-foreground line-clamp-3">
                  {node.description}
                </p>
              ) : (
                <p className="text-sm leading-6 text-muted-foreground">
                  Cluster related evidence cards here and keep enough room between them to read each one cleanly.
                </p>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {aiGenerated ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200">
                  <Sparkles className="h-3 w-3" />
                  AI
                </span>
              ) : null}
              <Badge className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold text-secondary-foreground hover:bg-secondary">
                {memberCount} card{memberCount === 1 ? "" : "s"}
              </Badge>
            </div>
          </div>
        </div>

        <div className="relative flex-1 px-7 py-6">
          <div className="absolute inset-x-7 top-6 bottom-6 rounded-[20px] border border-dashed border-border bg-muted/35" />
        </div>
      </div>

      <Handle
        id="source"
        type="source"
        position={Position.Right}
        className="!top-12 !h-3 !w-3 !border-2 !border-background !bg-emerald-500"
      />
    </div>
  );
}

// ─── Unified node card ─────────────────────────────────────────────────────────

function CanvasNodeCardComponent({ data, selected, dragging }: NodeProps) {
  const typedData = data as unknown as CanvasNodeCardData;
  const node = typedData.node;

  if (node.type === "insight") {
    return (
      <InsightCard
        node={node}
        isNestedInGroup={typedData.isNestedInGroup}
        selected={Boolean(selected)}
      />
    );
  }

  return (
    <ThemeCard
      node={node}
      selected={Boolean(selected)}
      aiGenerated={typedData.aiGenerated}
      dragging={Boolean(dragging)}
    />
  );
}

export const CanvasNodeCard = memo(CanvasNodeCardComponent);
