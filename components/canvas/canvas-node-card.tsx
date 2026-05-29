"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Handle, Position, type NodeProps, useUpdateNodeInternals } from "@xyflow/react";
import { BookOpen, ChevronDown, Pencil, Sparkles } from "lucide-react";
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

/** Matches canvas-handles.css hover expand duration. */
export const HOVER_EXPAND_MS = 240;

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
  onRenameGroup?: (id: string, name: string, description: string) => void;
}

function hoverPreviewEnabled(
  perCardExpanded: boolean | undefined,
  globalDensity: CardDensity
): boolean {
  const resolved = resolveCardExpanded(perCardExpanded, globalDensity);
  return !resolved && perCardExpanded !== false;
}

function measureHoverContentHeights(contentEl: HTMLElement): {
  compact: number;
  expanded: number;
} {
  const compact = contentEl.getBoundingClientRect().height;
  contentEl.classList.add("canvas-is-measuring");
  const expanded = contentEl.scrollHeight;
  contentEl.classList.remove("canvas-is-measuring");
  return { compact, expanded: Math.max(compact, expanded) };
}

function useHoverExpandPreview(
  nodeId: string,
  enabled: boolean,
  contentRef: React.RefObject<HTMLDivElement | null>,
  contentKey: string
) {
  const updateNodeInternals = useUpdateNodeInternals();
  const [isOpen, setIsOpen] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [pinning, setPinning] = useState(false);
  const [heights, setHeights] = useState<{ compact: number; expanded: number } | null>(
    null
  );
  const isOpenRef = useRef(false);
  const reducedMotionRef = useRef(false);

  useLayoutEffect(() => {
    reducedMotionRef.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
  }, []);

  const measureHeights = useCallback(() => {
    const el = contentRef.current;
    if (!el) return null;
    return measureHoverContentHeights(el);
  }, [contentRef]);

  useLayoutEffect(() => {
    if (!enabled) {
      setHeights(null);
      setIsOpen(false);
      setRevealed(false);
      setPinning(false);
      isOpenRef.current = false;
      return;
    }
    const measured = measureHeights();
    if (measured) setHeights(measured);
  }, [enabled, measureHeights, contentKey]);

  const syncNodeInternals = useCallback(() => {
    requestAnimationFrame(() => updateNodeInternals(nodeId));
  }, [nodeId, updateNodeInternals]);

  const openPreview = useCallback(() => {
    if (!enabled) return;
    const measured = measureHeights();
    if (measured) setHeights(measured);
    isOpenRef.current = true;
    setPinning(true);
    setRevealed(false);
    setIsOpen(false);
    syncNodeInternals();
    requestAnimationFrame(() => {
      setIsOpen(true);
      setRevealed(true);
      syncNodeInternals();
    });
  }, [enabled, measureHeights, syncNodeInternals]);

  const closePreview = useCallback(() => {
    if (!enabled) return;
    isOpenRef.current = false;
    setIsOpen(false);
    if (reducedMotionRef.current) {
      setRevealed(false);
      setPinning(false);
      syncNodeInternals();
    }
  }, [enabled, syncNodeInternals]);

  const onTransitionEnd = useCallback(
    (event: React.TransitionEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget || event.propertyName !== "max-height") {
        return;
      }
      if (!isOpenRef.current) {
        setRevealed(false);
        setPinning(false);
      }
      updateNodeInternals(nodeId);
    },
    [nodeId, updateNodeInternals]
  );

  const onBlur = useCallback(
    (event: React.FocusEvent<HTMLElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
        closePreview();
      }
    },
    [closePreview]
  );

  return {
    cardHandlers: enabled
      ? {
          onMouseEnter: openPreview,
          onMouseLeave: closePreview,
          onFocus: openPreview,
          onBlur,
        }
      : {},
    contentProps: enabled
      ? {
          ref: contentRef,
          className: cn(
            "canvas-hover-content",
            pinning && "canvas-hover-content--clip canvas-hover-content--animate"
          ),
          style:
            heights && pinning
              ? { maxHeight: isOpen ? heights.expanded : heights.compact }
              : undefined,
          "data-hover-expanded": revealed ? "true" : "false",
          onTransitionEnd,
        }
      : {},
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
  const contentRef = useRef<HTMLDivElement>(null);
  const contentKey = `${node.label}|${node.description ?? ""}|${node.researchReferenceLabel ?? ""}|${node.sourceConsultationTitle ?? ""}`;
  const { cardHandlers, contentProps } = useHoverExpandPreview(
    nodeId,
    hoverPreview,
    contentRef,
    contentKey
  );

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
      data-hover-preview={hoverPreview ? "true" : "false"}
      {...cardHandlers}
    >
      <Handle
        id="target"
        type="target"
        position={Position.Left}
        className={cn(CANVAS_HANDLE_BASE, "!bg-primary")}
      />

      <div {...contentProps}>
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
  onRenameGroup,
}: {
  nodeId: string;
  node: CanvasNode;
  selected: boolean;
  aiGenerated?: boolean;
  dragging?: boolean;
  onRenameGroup?: (id: string, name: string, description: string) => void;
}) {
  const [editingField, setEditingField] = useState<"name" | "description" | null>(null);
  const [draftName, setDraftName] = useState(node.label);
  const [draftDescription, setDraftDescription] = useState(node.description ?? "");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);

  const canEdit = Boolean(onRenameGroup);
  const memberCount = node.memberIds.length;
  const hasDescription = Boolean(node.description?.trim());

  useEffect(() => {
    if (editingField === "name") {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    } else if (editingField === "description") {
      descRef.current?.focus();
    }
  }, [editingField]);

  function commitEdit() {
    if (!onRenameGroup) return;
    const name = draftName.trim() || node.label;
    const description = draftDescription.trim();
    onRenameGroup(nodeId, name, description);
    setEditingField(null);
  }

  function cancelEdit() {
    setDraftName(node.label);
    setDraftDescription(node.description ?? "");
    setEditingField(null);
  }

  function startEditName() {
    if (!canEdit) return;
    setDraftName(node.label);
    setEditingField("name");
  }

  function startEditDescription() {
    if (!canEdit) return;
    setDraftDescription(node.description ?? "");
    setEditingField("description");
  }

  return (
    <div
      className={cn(
        "group relative h-full w-full overflow-hidden rounded-[24px] border bg-card shadow-sm transition-opacity motion-reduce:transition-none",
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
        className={cn(CANVAS_HANDLE_BASE, "!top-12 !left-3 !bg-emerald-500")}
      />

      <div className="relative flex h-full flex-col">
        <div className="border-b border-border/80 px-7 py-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1.5">
              {/* Name — inline editable */}
              {editingField === "name" ? (
                <input
                  ref={nameInputRef}
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
                    if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  maxLength={80}
                  className="w-full rounded-sm border-0 border-b border-foreground/30 bg-transparent pb-0.5 text-base font-semibold leading-tight text-foreground focus:outline-none focus:border-foreground/60"
                />
              ) : (
                <div
                  className={cn(
                    "group/name flex items-center gap-1.5",
                    canEdit && "cursor-text"
                  )}
                  onPointerDown={(e) => { if (canEdit) e.stopPropagation(); }}
                  onClick={startEditName}
                >
                  <p
                    className={cn(
                      "text-base font-semibold leading-tight text-foreground",
                      canEdit && "group-hover/name:underline decoration-muted-foreground/35 decoration-dotted underline-offset-2"
                    )}
                  >
                    {node.label}
                  </p>
                  {canEdit ? (
                    <Pencil className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/name:opacity-50" />
                  ) : null}
                </div>
              )}

              {/* Description — inline editable */}
              {editingField === "description" ? (
                <textarea
                  ref={descRef}
                  value={draftDescription}
                  onChange={(e) => setDraftDescription(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  maxLength={300}
                  rows={3}
                  className="w-full resize-none rounded-sm border-0 border-b border-foreground/30 bg-transparent pb-0.5 text-sm leading-6 text-muted-foreground focus:outline-none focus:border-foreground/60"
                />
              ) : (
                <div
                  className={cn(
                    "group/desc flex items-start gap-1.5",
                    canEdit && "cursor-text"
                  )}
                  onPointerDown={(e) => { if (canEdit) e.stopPropagation(); }}
                  onClick={startEditDescription}
                >
                  <p
                    className={cn(
                      "max-w-[42ch] text-sm leading-6",
                      hasDescription
                        ? "text-muted-foreground"
                        : canEdit
                          ? "text-muted-foreground/45 italic"
                          : "text-muted-foreground",
                      canEdit && hasDescription && "group-hover/desc:underline decoration-muted-foreground/35 decoration-dotted underline-offset-2"
                    )}
                  >
                    {hasDescription
                      ? node.description
                      : canEdit
                        ? "Add a description…"
                        : "Cluster related evidence cards here and keep enough room between them to read each one cleanly."}
                  </p>
                  {canEdit ? (
                    <Pencil className="mt-1 h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/desc:opacity-50" />
                  ) : null}
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-start gap-1">
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
      onRenameGroup={typedData.onRenameGroup}
    />
  );
}

export const CanvasNodeCard = memo(CanvasNodeCardComponent);
