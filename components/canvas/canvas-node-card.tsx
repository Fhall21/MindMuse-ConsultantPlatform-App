"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Link2, Layers3, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CanvasNode } from "@/types/canvas";

export interface CanvasNodeCardData {
  node: CanvasNode;
  selectionCount: number;
}

function CanvasNodeCardComponent({
  data,
  selected,
}: NodeProps) {
  const typedData = data as unknown as CanvasNodeCardData;
  const node = typedData.node;
  const isInsight = node.type === "insight";
  const memberCount = node.memberIds.length;

  return (
    <div
      className={cn(
        "group relative min-w-[220px] max-w-[260px] rounded-2xl border bg-background/96 p-3 shadow-sm transition-shadow",
        isInsight
          ? "border-emerald-200/80"
          : "border-sky-200/80 bg-sky-50/90 dark:border-sky-900/60 dark:bg-sky-950/30",
        selected && "ring-2 ring-primary ring-offset-2 shadow-lg"
      )}
      data-testid={isInsight ? "canvas-insight-card" : "canvas-group-card"}
    >
      <Handle
        id="target"
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !border-2 !border-background !bg-sky-500"
      />

      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className="h-5 rounded-full px-2 text-[10px] uppercase tracking-wide">
              {isInsight ? "Insight" : "Theme group"}
            </Badge>
            {isInsight && node.sourceConsultationTitle ? (
              <Badge
                variant="secondary"
                className="h-5 max-w-[150px] truncate rounded-full px-2 text-[10px]"
                title={node.sourceConsultationTitle}
              >
                {node.sourceConsultationTitle}
              </Badge>
            ) : null}
            {node.accepted ? (
              <Badge variant="secondary" className="h-5 rounded-full px-2 text-[10px]">
                Accepted
              </Badge>
            ) : null}
          </div>

          <div className="space-y-1">
            <p className="text-sm font-semibold leading-snug text-foreground">
              {node.label}
            </p>
            {node.description ? (
              <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                {node.description}
              </p>
            ) : null}
          </div>
        </div>

        <div
          className={cn(
            "shrink-0 rounded-full border px-2 py-1 text-[10px] font-medium text-muted-foreground",
            selected && "border-primary/50 text-primary"
          )}
        >
          {typedData.selectionCount > 1 && selected
            ? `${typedData.selectionCount} selected`
            : "Drag"}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {isInsight && node.lockedFromSource ? (
          <Badge variant="outline" className="h-5 rounded-full px-2 text-[10px]">
            Locked
          </Badge>
        ) : null}
        {isInsight && node.isUserAdded ? (
          <Badge variant="outline" className="h-5 rounded-full px-2 text-[10px]">
            User added
          </Badge>
        ) : null}
        {!isInsight ? (
          <Badge variant="outline" className="h-5 rounded-full px-2 text-[10px]">
            {memberCount} insight{memberCount === 1 ? "" : "s"}
          </Badge>
        ) : null}
        {!isInsight && node.sourceConsultationTitle ? (
          <Badge variant="secondary" className="h-5 rounded-full px-2 text-[10px]">
            {node.sourceConsultationTitle}
          </Badge>
        ) : null}
      </div>

      <div className="pointer-events-none absolute -right-3 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-full border bg-background px-2 py-1 text-[10px] font-medium text-muted-foreground shadow-sm">
        {isInsight ? <Sparkles className="h-3 w-3" /> : <Layers3 className="h-3 w-3" />}
        <span>{isInsight ? "Drop to group" : "Drop to add"}</span>
      </div>

      <div className="pointer-events-none absolute -bottom-3 right-4 rounded-full border bg-background px-2 py-1 text-[10px] font-medium text-muted-foreground shadow-sm">
        <div className="flex items-center gap-1">
          <Link2 className="h-3 w-3" />
          <span>Connect</span>
        </div>
      </div>

      <Handle
        id="source"
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !border-2 !border-background !bg-emerald-500"
      />
    </div>
  );
}

export const CanvasNodeCard = memo(CanvasNodeCardComponent);
