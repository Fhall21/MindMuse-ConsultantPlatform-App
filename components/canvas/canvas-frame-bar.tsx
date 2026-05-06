"use client";

import { useState } from "react";
import { Frame as FrameIcon, ImageDown, Layers, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { CanvasFrame } from "@/types/canvas";

interface CanvasFrameBarProps {
  frames: CanvasFrame[];
  activeFrameId: string | null;
  /** When true, the canvas is in frame-drawing mode (Draw button highlighted). */
  drawingMode?: boolean;
  /** Disable the Export button while a capture is in flight. */
  exporting?: boolean;
  onSelectFrame: (frameId: string | null) => void;
  onRenameFrame: (frameId: string, name: string) => void;
  onDeleteFrame: (frameId: string) => void;
  /** Toggle frame-drawing mode (rubber-band rect on the canvas). */
  onToggleDrawingMode?: () => void;
  /** Trigger image export — full canvas + one image per frame. */
  onExportImages?: () => void;
  disabled?: boolean;
}

/**
 * Tab bar + actions for canvas frames. Houses both selection (tabs) and the
 * frame-creation entry point (Draw button) so the canvas top toolbar can
 * stay focused on filters and AI controls.
 */
export function CanvasFrameBar({
  frames,
  activeFrameId,
  drawingMode = false,
  exporting = false,
  onSelectFrame,
  onRenameFrame,
  onDeleteFrame,
  onToggleDrawingMode,
  onExportImages,
  disabled,
}: CanvasFrameBarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  function startEdit(frame: CanvasFrame, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingId(frame.id);
    setEditingName(frame.name);
  }

  function commitEdit() {
    if (!editingId) return;
    const name = editingName.trim();
    if (name) onRenameFrame(editingId, name);
    setEditingId(null);
  }

  function abortEdit() {
    setEditingId(null);
  }

  return (
    <div
      className="flex items-center gap-0.5 overflow-x-auto border-b bg-background/60 px-3 py-1.5 scrollbar-none"
      role="tablist"
      aria-label="Canvas frames"
    >
      <Layers className="mr-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />

      {/* All tab */}
      <FrameTab
        label="All"
        active={activeFrameId === null}
        badge={frames.length > 0 ? frames.length : undefined}
        onClick={() => onSelectFrame(null)}
        disabled={disabled}
      />

      {frames.length > 0 && (
        <span className="mx-1.5 h-3.5 w-px shrink-0 bg-border" aria-hidden />
      )}

      {/* Frame tabs */}
      {frames.map((frame) => (
        <div key={frame.id} className="group relative flex shrink-0 items-center">
          {editingId === frame.id ? (
            <Input
              autoFocus
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitEdit();
                if (e.key === "Escape") abortEdit();
              }}
              className="h-6 w-28 rounded px-1.5 py-0 text-xs"
            />
          ) : (
            <button
              role="tab"
              aria-selected={activeFrameId === frame.id}
              disabled={disabled}
              onClick={() => onSelectFrame(frame.id)}
              onDoubleClick={(e) => startEdit(frame, e)}
              title={`${frame.name} — double-click to rename`}
              className={cn(
                "flex h-6 items-center rounded px-2.5 text-xs font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                "select-none pr-6",
                activeFrameId === frame.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {frame.name}
            </button>
          )}

          {editingId !== frame.id && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteFrame(frame.id);
                  }}
                  className={cn(
                    "absolute right-0.5 top-1/2 -translate-y-1/2",
                    "flex h-3.5 w-3.5 items-center justify-center rounded-full",
                    "text-muted-foreground/0 transition-all group-hover:text-muted-foreground",
                    "hover:bg-destructive/10 hover:text-destructive"
                  )}
                  aria-label={`Delete frame "${frame.name}"`}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Delete frame
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      ))}

      {/* Spacer so action buttons sit at the far right of the bar. */}
      <div className="ml-auto flex items-center gap-1.5">
        {onToggleDrawingMode ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={drawingMode ? "default" : "ghost"}
                size="sm"
                onClick={onToggleDrawingMode}
                disabled={disabled}
                aria-pressed={drawingMode}
                className="h-7 gap-1.5 px-2.5 text-xs"
              >
                <FrameIcon className="h-3.5 w-3.5" />
                {drawingMode ? "Drawing…" : "Draw frame"}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Click and drag on the canvas to draw a frame
            </TooltipContent>
          </Tooltip>
        ) : null}
        {onExportImages ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onExportImages}
                disabled={disabled || exporting}
                className="h-7 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <ImageDown className="h-3.5 w-3.5" />
                {exporting ? "Exporting…" : "Export"}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Download canvas + one image per frame
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </div>
  );
}

function FrameTab({
  label,
  active,
  badge,
  onClick,
  disabled,
}: {
  label: string;
  active: boolean;
  badge?: number;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-6 shrink-0 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        "select-none",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {label}
      {badge !== undefined && (
        <span
          className={cn(
            "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] tabular-nums",
            active
              ? "bg-primary-foreground/20 text-primary-foreground"
              : "bg-muted text-muted-foreground"
          )}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
