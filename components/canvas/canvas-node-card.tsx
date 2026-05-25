"use client";

import { memo, useCallback, useRef } from "react";
import { Handle, Position, type NodeProps, useUpdateNodeInternals } from "@xyflow/react";
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

const HOVER_EXPAND_MS = 200;

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

function hoverPreviewEnabled(
  perCardExpanded: boolean | undefined,
  globalDensity: CardDensity
): boolean {
  const resolved = resolveCardExpanded(perCardExpanded, globalDensity);
  return !resolved && perCardExpanded !== false;
}

function useHoverNodeResize(nodeId: string, enabled: boolean) {
  const updateNodeInternals = useUpdateNodeInternals();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleResize = useCallback(() => {
    if (!enabled) return;
    requestAnimationFrame(() => updateNodeInternals(nodeId));
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      updateNodeInternals(nodeId);
      timerRef.current = null;
    }, HOVER_EXPAND_MS);
  }, [enabled, nodeId, updateNodeInternals]);

  return {
    onMouseEnter: scheduleResize,
    onMouseLeave: scheduleResize,
    onFocus: scheduleResize,
    onBlur: scheduleResize,
  };
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

function ClampedText({
  text,
  expanded,
  hoverPreview,
  clampClass,
  textClassName,
}: {
  text: string;
  expanded: boolean;
  hoverPreview: boolean;
  clampClass: string;
  textClassName: string;
}) {
  return (
    <p
      className={cn(
        textClassName,
        !expanded && clampClass,
        hoverPreview && !expanded && "canvas-hover-clamp"
      )}
    >
      {text}
    </p>
  );
}

function SourceBadge({
  label,
  className,
  expanded,
  hoverPreview,
}: {
  label: string;
  className?: string;
  expanded: boolean;
  hoverPreview: boolean;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "px-2 py-0.5 text-[10px]",
        !expanded && "max-w-full truncate",
        hoverPreview && !expanded && "canvas-hover-badge",
        className
      )}
    >
      {label}
    </Badge>
  );
}

function InsightCard({
  nodeId,
  node,
  isNestedInGroup,
  selected,
  expanded,
  hoverPreview,
  showExpandControl,
  onToggleExpand,
}: {
  nodeId: string;
  node: CanvasNode;
  isNestedInGroup: boolean;
  selected: boolean;
  expanded: boolean;
  hoverPreview: boolean;
  showExpandControl: boolean;
  onToggleExpand?: () => void;
}) {
  const isResearch = node.sourceType === "research";
  const hoverHandlers = useHoverNodeResize(nodeId, hoverPreview);

  return (
    <div
      className={cn(
        "group relative h-full w-full rounded-xl border bg-background/95 px-4 py-3 shadow-sm transition-[border-color,box-shadow,transform] motion-reduce:transition-none",
        "min-h-[56px]",
        hoverPreview && "canvas-card-hover-expand",
        isNestedInGroup && "border-violet-200 bg-white/95 dark:border-violet-900 dark:bg-slate-950/95",
        isResearch &&
          "border-stone-300 bg-stone-50/90 dark:border-stone-700 dark:bg-stone-900/60",
        selected && "border-primary ring-2 ring-primary/20 shadow-lg"
      )}
      data-testid={isResearch ? "canvas-research-insight-card" : "canvas-insight-card"}
      data-source-type={node.sourceType}
      data-expanded={expanded ? "true" : "false"}
      data-hover-preview={hoverPreview ? "true" : "false"}
      {...hoverHandlers}
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
              !expanded && "line-clamp-2",
              hoverPreview && !expanded && "canvas-hover-clamp"
            )}
          >
            {node.label}
          </p>
          {node.description ? (
            <ClampedText
              text={node.description}
              expanded={expanded}
              hoverPreview={hoverPreview}
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

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {isResearch && node.researchReferenceLabel ? (
          <SourceBadge
            label={node.researchReferenceLabel}
            expanded={expanded}
            hoverPreview={hoverPreview}
            className="max-w-[180px] border-stone-300 bg-stone-100 text-stone-700 dark:border-stone-700 dark:bg-stone-900/80 dark:text-stone-300"
          />
        ) : node.sourceConsultationTitle ? (
          <SourceBadge
            label={node.sourceConsultationTitle}
            expanded={expanded}
            hoverPreview={hoverPreview}
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
  nodeId,
  node,
  selected,
  aiGenerated,
  dragging,
  expanded,
  hoverPreview,
  showExpandControl,
  onToggleExpand,
}: {
  nodeId: string;
  node: CanvasNode;
  selected: boolean;
  aiGenerated?: boolean;
  dragging?: boolean;
  expanded: boolean;
  hoverPreview: boolean;
  showExpandControl: boolean;
  onToggleExpand?: () => void;
}) {
  const memberCount = node.memberIds.length;
  const hasDescription = Boolean(node.description?.trim());
  const hoverHandlers = useHoverNodeResize(nodeId, hoverPreview);

  return (
    <div
      className={cn(
        "group relative h-full w-full rounded-[24px] border bg-card shadow-sm transition-opacity motion-reduce:transition-none",
        "border-border/80",
        hoverPreview ? "canvas-card-hover-expand" : "overflow-hidden",
        dragging && "opacity-45",
        selected && "border-foreground/20 ring-2 ring-foreground/10 shadow-lg"
      )}
      data-testid="canvas-group-card"
      data-expanded={expanded ? "true" : "false"}
      data-hover-preview={hoverPreview ? "true" : "false"}
      {...hoverHandlers}
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
                  !expanded && "line-clamp-2",
                  hoverPreview && !expanded && "canvas-hover-clamp"
                )}
              >
                {node.label}
              </p>
              {hasDescription ? (
                <ClampedText
                  text={node.description!}
                  expanded={expanded}
                  hoverPreview={hoverPreview}
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
  const globalDensity = typedData.globalDensity ?? "compact";
  const expanded = resolveCardExpanded(typedData.expanded, globalDensity);
  const hoverPreview = hoverPreviewEnabled(typedData.expanded, globalDensity);
  const showExpandControl = cardHasClampableText(node);

  if (node.type === "insight") {
    return (
      <InsightCard
        nodeId={id}
        node={node}
        isNestedInGroup={typedData.isNestedInGroup}
        selected={Boolean(selected)}
        expanded={expanded}
        hoverPreview={hoverPreview}
        showExpandControl={showExpandControl}
        onToggleExpand={() => typedData.onToggleExpand?.(id)}
      />
    );
  }

  return (
    <ThemeCard
      nodeId={id}
      node={node}
      selected={Boolean(selected)}
      aiGenerated={typedData.aiGenerated}
      dragging={Boolean(dragging)}
      expanded={expanded}
      hoverPreview={hoverPreview}
      showExpandControl={showExpandControl}
      onToggleExpand={() => typedData.onToggleExpand?.(id)}
    />
  );
}

export const CanvasNodeCard = memo(CanvasNodeCardComponent);
