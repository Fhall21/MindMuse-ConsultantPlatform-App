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
}

// ─── Insight card ──────────────────────────────────────────────────────────────
// Compact design: ~40px height, 180-200px width. Single row with label, accepted dot,
// source badge. Grouped insights show violet left border for visual indication.
// Removed: description, footer hints, grip icon, isUserAdded badge.

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
        "group relative rounded-md border bg-background px-3 py-2 transition-shadow",
        "min-w-[180px] max-w-[200px]",
        isNestedInGroup && "border-l-2 border-l-violet-400 pl-2.5",
        selected && "border-primary ring-2 ring-primary/20"
      )}
      data-testid="canvas-insight-card"
    >
      <Handle
        id="target"
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border-2 !border-background !bg-primary"
      />

      <div className="flex items-center gap-1.5">
        <p className="min-w-0 flex-1 text-xs font-medium leading-tight line-clamp-1">
          {node.label}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          {node.accepted ? (
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full bg-emerald-500"
              title="Accepted"
            />
          ) : null}
          {node.sourceConsultationTitle ? (
            <Badge
              variant="outline"
              className="h-4 max-w-[80px] truncate border-amber-200 bg-amber-50 px-1 text-[10px] text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
              title={node.sourceConsultationTitle}
            >
              {node.sourceConsultationTitle}
            </Badge>
          ) : null}
        </div>
      </div>

      <Handle
        id="source"
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border-2 !border-background !bg-primary"
      />
    </div>
  );
}

// ─── Theme / group card ────────────────────────────────────────────────────────
// Compact group container: 240-280px width. Header row with label, AI sparkle, member count.
// Member preview as stacked text list (max 3 items). Removed: grip icon, footer, empty state text.
// Uses ReactFlow flat layout (no parentId) — visual group membership via styling only.

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
  const displayLabels = memberPreviewLabels.slice(0, 3);
  const extraCount = Math.max(0, memberCount - displayLabels.length);

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border-2 bg-violet-50/60 dark:bg-violet-950/30",
        "min-w-[240px] max-w-[280px]",
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
        className="!left-3 !h-2.5 !w-2.5 !border-2 !border-background !bg-violet-500"
      />

      {/* Header */}
      <div className="px-3 py-2 pl-4">
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 flex-1 text-xs font-semibold leading-tight text-violet-900 line-clamp-1 dark:text-violet-100">
            {node.label}
          </p>
          <div className="flex shrink-0 items-center gap-1">
            {aiGenerated ? (
              <span className="inline-flex items-center gap-0.5 text-[9px] text-violet-500">
                <Sparkles className="h-2.5 w-2.5" />
              </span>
            ) : null}
            <Badge className="h-4 rounded-full bg-violet-200 px-1.5 text-[10px] font-medium text-violet-800 hover:bg-violet-200 dark:bg-violet-800 dark:text-violet-200">
              {memberCount}
            </Badge>
          </div>
        </div>
      </div>

      {/* Member preview list */}
      {displayLabels.length > 0 ? (
        <div className="border-t border-violet-200/60 px-4 py-1.5 dark:border-violet-800/60">
          {displayLabels.map((label, i) => (
            <p
              key={i}
              className="truncate text-[10px] leading-[16px] text-violet-700/80 dark:text-violet-300/80"
              title={label}
            >
              {label}
            </p>
          ))}
          {extraCount > 0 ? (
            <p className="text-[10px] leading-[16px] text-violet-400 dark:text-violet-500">
              +{extraCount} more
            </p>
          ) : null}
        </div>
      ) : null}

      <Handle
        id="source"
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border-2 !border-background !bg-violet-500"
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
