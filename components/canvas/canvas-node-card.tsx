"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { GripVertical, Link2, Layers3, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CanvasNode } from "@/types/canvas";

export interface CanvasNodeCardData {
  node: CanvasNode;
  isNestedInGroup: boolean;
  memberPreviewLabels: string[];
  aiGenerated?: boolean;
}

// ─── Insight card ──────────────────────────────────────────────────────────────

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
        "group relative rounded-lg border bg-background px-3 py-2.5 shadow-sm transition-shadow",
        !isNestedInGroup && "min-h-[120px] min-w-[200px] max-w-[248px]",
        isNestedInGroup && "min-h-[88px] min-w-[172px] max-w-[208px]",
        selected && "border-primary ring-2 ring-primary/20"
      )}
      data-testid="canvas-insight-card"
    >
      <Handle
        id="target"
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !border-2 !border-background !bg-primary"
      />

      <div className="mb-2 flex items-start gap-2">
        <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium leading-snug text-foreground">{node.label}</p>
          {node.description ? (
            <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {node.description}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <Badge variant="outline" className="h-4.5 rounded-full px-2 text-[10px] font-normal text-muted-foreground">
          Insight
        </Badge>
        {node.sourceConsultationTitle ? (
          <Badge
            variant="secondary"
            className="h-4.5 max-w-[130px] truncate rounded-full px-2 text-[10px]"
            title={node.sourceConsultationTitle}
          >
            {node.sourceConsultationTitle}
          </Badge>
        ) : null}
        {node.accepted ? (
          <Badge variant="secondary" className="h-4.5 rounded-full bg-emerald-50 px-2 text-[10px] text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
            Accepted
          </Badge>
        ) : null}
        {node.isUserAdded ? (
          <Badge variant="outline" className="h-4.5 rounded-full px-2 text-[10px]">
            Added
          </Badge>
        ) : null}
      </div>

      <div className="pointer-events-none mt-2 flex items-center justify-between border-t pt-1.5 text-[10px] text-muted-foreground/60">
        <span className="inline-flex items-center gap-1">
          <Layers3 className="h-3 w-3" />
          Drag to group
        </span>
        <span className="inline-flex items-center gap-1">
          <Link2 className="h-3 w-3" />
          Connect
        </span>
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

// ─── Theme / group card ────────────────────────────────────────────────────────

function ThemeCard({
  node,
  memberPreviewLabels,
  selected,
  aiGenerated,
}: {
  node: CanvasNode;
  memberPreviewLabels: string[];
  selected: boolean;
  aiGenerated?: boolean;
}) {
  const memberCount = node.memberIds.length;
  const extraCount = Math.max(0, memberCount - memberPreviewLabels.length);

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border-2 bg-violet-50/60 dark:bg-violet-950/30",
        "min-h-[160px] min-w-[280px] max-w-[320px]",
        "border-violet-200 dark:border-violet-800",
        selected && "border-violet-500 ring-2 ring-violet-400/30 dark:border-violet-400"
      )}
      data-testid="canvas-group-card"
    >
      {/* Left accent stripe */}
      <div className="absolute inset-y-0 left-0 w-1 bg-violet-400 dark:bg-violet-500" />

      <Handle
        id="target"
        type="target"
        position={Position.Left}
        className="!left-3 !h-3 !w-3 !border-2 !border-background !bg-violet-500"
      />

      {/* Header */}
      <div className="px-4 pb-2 pt-3 pl-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <GripVertical className="h-3.5 w-3.5 shrink-0 text-violet-400" />
              <p className="text-sm font-semibold leading-snug text-violet-900 dark:text-violet-100">
                {node.label}
              </p>
            </div>
            {node.description ? (
              <p className="mt-0.5 line-clamp-2 pl-5 text-xs leading-relaxed text-violet-700/70 dark:text-violet-300/70">
                {node.description}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1">
            <Badge className="h-5 rounded-full bg-violet-200 px-2 text-[10px] font-medium text-violet-800 hover:bg-violet-200 dark:bg-violet-800 dark:text-violet-200">
              Theme
            </Badge>
            {aiGenerated ? (
              <span className="inline-flex items-center gap-0.5 text-[9px] text-violet-500">
                <Sparkles className="h-2.5 w-2.5" />
                AI titled
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Member chips */}
      {memberPreviewLabels.length > 0 ? (
        <div className="px-5 pb-3">
          <div className="flex flex-wrap gap-1">
            {memberPreviewLabels.map((label) => (
              <span
                key={label}
                className="inline-block max-w-[200px] truncate rounded-full border border-violet-200 bg-background/80 px-2 py-0.5 text-[10px] text-foreground dark:border-violet-700"
                title={label}
              >
                {label}
              </span>
            ))}
            {extraCount > 0 ? (
              <span className="inline-block rounded-full border border-violet-200 bg-background/80 px-2 py-0.5 text-[10px] text-muted-foreground dark:border-violet-700">
                +{extraCount} more
              </span>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="px-5 pb-3">
          <p className="text-xs text-violet-400 dark:text-violet-500">
            Drop insights here to group
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-violet-200/60 px-5 py-1.5 dark:border-violet-800/60">
        <span className="text-[10px] font-medium text-violet-600 dark:text-violet-400">
          {memberCount} insight{memberCount === 1 ? "" : "s"}
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] text-violet-400 dark:text-violet-500">
          <Link2 className="h-3 w-3" />
          Connect
        </span>
      </div>

      <Handle
        id="source"
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !border-2 !border-background !bg-violet-500"
      />
    </div>
  );
}

// ─── Unified node card ─────────────────────────────────────────────────────────

function CanvasNodeCardComponent({ data, selected }: NodeProps) {
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
      memberPreviewLabels={typedData.memberPreviewLabels}
      selected={Boolean(selected)}
      aiGenerated={typedData.aiGenerated}
    />
  );
}

export const CanvasNodeCard = memo(CanvasNodeCardComponent);
