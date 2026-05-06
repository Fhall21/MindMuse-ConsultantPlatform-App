"use client";

import { useRef, useState } from "react";
import { Layers, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { CanvasFrame } from "@/types/canvas";

interface CanvasFrameBarProps {
  frames: CanvasFrame[];
  activeFrameId: string | null;
  onSelectFrame: (frameId: string | null) => void;
  onCreateFrame: (name: string) => void;
  onRenameFrame: (frameId: string, name: string) => void;
  onDeleteFrame: (frameId: string) => void;
  disabled?: boolean;
}

export function CanvasFrameBar({
  frames,
  activeFrameId,
  onSelectFrame,
  onCreateFrame,
  onRenameFrame,
  onDeleteFrame,
  disabled,
}: CanvasFrameBarProps) {
  const [newName, setNewName] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const newNameInputRef = useRef<HTMLInputElement>(null);

  function handleOpenCreate(open: boolean) {
    setCreateOpen(open);
    if (open) {
      setNewName("");
      setTimeout(() => newNameInputRef.current?.focus(), 0);
    }
  }

  function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    onCreateFrame(name);
    setNewName("");
    setCreateOpen(false);
  }

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

      {/* Create frame */}
      <Popover open={createOpen} onOpenChange={handleOpenCreate}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                disabled={disabled}
                className="ml-0.5 h-6 w-6 shrink-0 p-0 text-muted-foreground hover:text-foreground"
                aria-label="Create frame"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Create frame
          </TooltipContent>
        </Tooltip>

        <PopoverContent className="w-60 p-3" align="start" sideOffset={6}>
          <p className="mb-1 text-xs font-medium text-foreground">New frame</p>
          <p className="mb-2.5 text-xs text-muted-foreground">
            Name this curated view of the canvas
          </p>
          <div className="flex gap-1.5">
            <Input
              ref={newNameInputRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") setCreateOpen(false);
              }}
              placeholder="e.g. Wellbeing cluster"
              className="h-7 text-xs"
            />
            <Button
              size="sm"
              className="h-7 shrink-0 px-2.5 text-xs"
              onClick={handleCreate}
              disabled={!newName.trim()}
            >
              Add
            </Button>
          </div>
        </PopoverContent>
      </Popover>
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
