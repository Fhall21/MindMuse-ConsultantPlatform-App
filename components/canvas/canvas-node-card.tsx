"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { BookOpen, ChevronDown, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  cardHasClampableText,
  resolveCardExpanded,
  type CardDensity,
} from "@/lib/canvas-card-density";
import type { CanvasNode } from "@/types/canvas";

/** 20px visual dot + canvas-handles.css 32px hit target. */
const CANVAS_HANDLE_BASE =
  "canvas-connection-handle !h-5 !w-5 !border-2 !border-background";

export interface CanvasNodeCardData {
  node: CanvasNode;
  isNestedInGroup: boolean;
  memberPreviewLabels: string[];
  aiGenerated?: boolean;
  containerWidth?: number;
  containerHeight?: number;
  /** Per-card expand override; undefined follows globalDensity. */
  expanded?: boolean;
  globalDensity?: CardDensity;
  onToggleExpand?: (nodeId: string) => void;
}

function ExpandChevron({
  expanded,
  visible,
  onToggle,
}: {
  expanded: boolean;
  visible: boolean;
  onToggle: () => void;
}) {
  if (!visible) return null;

  return (
    <button
      type="button"
      className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-expanded={expanded}
      aria-label={expanded ? "Collapse card" : "Expand card"}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
    >
      <ChevronDown
        className={cn(
          "h-3.5 w-3.5 motion-safe:transition-transform",
          expanded && "rotate-180"
        )}
      />
    </button>
  );
}

function MutedDescription({
  text,
  expanded,
  clampClass,
  textClassName,
}: {
  text: string;
  expanded: boolean;
  clampClass: string;
  textClassName: string;
}) {
  return (
    <div className="relative min-w-0">
      <p className={cn(textClassName, !expanded && clampClass)}>{text}</p>
      {!expanded ? (
        <div
          className="canvas-muted-text-preview pointer-events-none absolute left-0 top-0 z-20 hidden w-max max-w-[min(42ch,calc(100vw-2rem))] rounded-md border border-border bg-popover px-2.5 py-2 text-popover-foreground shadow-sm group-hover:block group-focus-within:block"
          aria-hidden
        >
          <p className={textClassName}>{text}</p>
        </div>
      ) : null}
    </div>
  );
}

function BylineBadge({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <span className="relative inline-flex max-w-full">
      <Badge
        variant="outline"
        className={cn("max-w-full truncate px-2 py-0.5 text-[10px]", className)}
      >
        {label}
      </Badge>
      <span
        className="canvas-muted-text-preview pointer-events-none absolute bottom-full left-0 z-30 mb-1 hidden w-max max-w-[min(36ch,calc(100vw-2rem))] rounded-md border border-border bg-popover px-2 py-1 text-[10px] leading-snug text-popover-foreground shadow-sm group-hover:block group-focus-within:block"
        aria-hidden
      >
        {label}
      </span>
    </span>
  );
}

function InsightCard({
  node,
  isNestedInGroup,
  selected,
  expanded,
  showExpandControl,
  onToggleExpand,
}: {
  node: CanvasNode;
  isNestedInGroup: boolean;
  selected: boolean;
  expanded: boolean;
  showExpandControl: boolean;
  onToggleExpand?: () => void;
}) {
  const isResearch = node.sourceType === "research";

  return (
    <div
      className={cn(
        "group relative h-full w-full rounded-xl border bg-background/95 px-4 py-3 shadow-sm transition-[border-color,box-shadow,transform] motion-reduce:transition-none",
        "min-h-[56px]",
        isNestedInGroup && "border-violet-200 bg-white/95 dark:border-violet-900 dark:bg-slate-950/95",
        isResearch &&
          "border-stone-300 bg-stone-50/90 dark:border-stone-700 dark:bg-stone-900/60",
        selected && "border-primary ring-2 ring-primary/20 shadow-lg"
      )}
      data-testid={isResearch ? "canvas-research-insight-card" : "canvas-insight-card"}
      data-source-type={node.sourceType}
      data-expanded={expanded ? "true" : "false"}
    >
      <Handle
        id="target"
        type="target"
        position={Position.Left}
        className={cn(CANVAS_HANDLE_BASE, "!bg-primary")}
      />

      <div className="flex items-start gap-2">
        {isResearch ? (
          <BookOpen
            className="mt-0.5 h-4 w-4 shrink-0 text-stone-600 dark:text-stone-300"
            aria-label="Research insight"
          />
        ) : null}
        <div className="min-w-0 flex-1 space-y-1">
          <p
            className={cn(
              "text-sm font-semibold leading-tight text-foreground",
              !expanded && "line-clamp-2"
            )}
          >
            {node.label}
          </p>
          {node.description ? (
            <MutedDescription
              text={node.description}
              expanded={expanded}
              clampClass="line-clamp-2"
              textClassName="text-xs leading-5 text-muted-foreground"
            />
          ) : null}
        </div>
        <ExpandChevron
          expanded={expanded}
          visible={showExpandControl}
          onToggle={() => onToggleExpand?.()}
        />
        {node.accepted ? (
          <span
            className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500"
            title="Accepted"
          />
        ) : null}
      </div>

      <div className="mt-3 flex items-center gap-2">
        {isResearch && node.researchReferenceLabel ? (
          <BylineBadge
            label={node.researchReferenceLabel}
            className="max-w-[180px] border-stone-300 bg-stone-100 text-stone-700 dark:border-stone-700 dark:bg-stone-900/80 dark:text-stone-300"
          />
        ) : node.sourceConsultationTitle ? (
          <BylineBadge
            label={node.sourceConsultationTitle}
            className="max-w-[140px] border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
          />
        ) : null}
        {node.isUserAdded && !isResearch ? (
          <Badge variant="outline" className="px-2 py-0.5 text-[10px]">
            Manual
          </Badge>
        ) : null}
      </div>

      <Handle
        id="source"
        type="source"
        position={Position.Right}
        className={cn(CANVAS_HANDLE_BASE, "!bg-primary")}
      />
    </div>
  );
}

function ThemeCard({
  node,
  selected,
  aiGenerated,
  dragging,
  expanded,
  showExpandControl,
  onToggleExpand,
}: {
  node: CanvasNode;
  selected: boolean;
  aiGenerated?: boolean;
  dragging?: boolean;
  expanded: boolean;
  showExpandControl: boolean;
  onToggleExpand?: () => void;
}) {
  const memberCount = node.memberIds.length;
  const hasDescription = Boolean(node.description?.trim());

  return (
    <div
      className={cn(
        "group relative h-full w-full overflow-hidden rounded-[24px] border bg-card shadow-sm transition-opacity motion-reduce:transition-none",
        "border-border/80",
        dragging && "opacity-45",
        selected && "border-foreground/20 ring-2 ring-foreground/10 shadow-lg"
      )}
      data-testid="canvas-group-card"
      data-expanded={expanded ? "true" : "false"}
    >
      <div className="absolute inset-y-0 left-0 w-1.5 bg-emerald-500/70" />

      <Handle
        id="target"
        type="target"
        position={Position.Left}
        className={cn(CANVAS_HANDLE_BASE, "!top-12 !left-3 !bg-emerald-500")}
      />

      <div className="relative flex h-full flex-col">
        <div className="border-b border-border/80 px-7 py-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <p
                className={cn(
                  "text-base font-semibold leading-tight text-foreground",
                  !expanded && "line-clamp-2"
                )}
              >
                {node.label}
              </p>
              {hasDescription ? (
                <MutedDescription
                  text={node.description!}
                  expanded={expanded}
                  clampClass="line-clamp-3"
                  textClassName="max-w-[42ch] text-sm leading-6 text-muted-foreground"
                />
              ) : (
                <p className="max-w-[42ch] text-sm leading-6 text-muted-foreground">
                  Cluster related evidence cards here and keep enough room between them to read each one cleanly.
                </p>
              )}
            </div>

            <div className="flex shrink-0 items-start gap-1">
              <ExpandChevron
                expanded={expanded}
                visible={showExpandControl}
                onToggle={() => onToggleExpand?.()}
              />
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
        className={cn(CANVAS_HANDLE_BASE, "!top-12 !bg-emerald-500")}
      />
    </div>
  );
}

function CanvasNodeCardComponent({ id, data, selected, dragging }: NodeProps) {
  const typedData = data as unknown as CanvasNodeCardData;
  const node = typedData.node;
  const expanded = resolveCardExpanded(typedData.expanded, typedData.globalDensity ?? "compact");
  const showExpandControl = cardHasClampableText(node);

  if (node.type === "insight") {
    return (
      <InsightCard
        node={node}
        isNestedInGroup={typedData.isNestedInGroup}
        selected={Boolean(selected)}
        expanded={expanded}
        showExpandControl={showExpandControl}
        onToggleExpand={() => typedData.onToggleExpand?.(id)}
      />
    );
  }

  return (
    <ThemeCard
      node={node}
      selected={Boolean(selected)}
      aiGenerated={typedData.aiGenerated}
      dragging={Boolean(dragging)}
      expanded={expanded}
      showExpandControl={showExpandControl}
      onToggleExpand={() => typedData.onToggleExpand?.(id)}
    />
  );
}

export const CanvasNodeCard = memo(CanvasNodeCardComponent);
