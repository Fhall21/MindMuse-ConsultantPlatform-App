"use client";

import { memo, useCallback, useState } from "react";
import { NodeResizer, type NodeProps } from "@xyflow/react";
import { Check, Palette } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { FRAME_COLORS, type FrameColor } from "@/types/canvas";

// Tailwind utility classes per palette value. Use literal class names so the
// JIT compiler picks them up (string concatenation would be purged).
const COLOR_CLASSES: Record<
  FrameColor,
  { fill: string; border: string; ring: string; dot: string; label: string }
> = {
  amber: {
    fill: "bg-amber-500/8",
    border: "border-amber-500/60",
    ring: "ring-amber-400",
    dot: "bg-amber-500",
    label: "Amber",
  },
  blue: {
    fill: "bg-blue-500/8",
    border: "border-blue-500/60",
    ring: "ring-blue-400",
    dot: "bg-blue-500",
    label: "Blue",
  },
  green: {
    fill: "bg-emerald-500/8",
    border: "border-emerald-500/60",
    ring: "ring-emerald-400",
    dot: "bg-emerald-500",
    label: "Green",
  },
  purple: {
    fill: "bg-violet-500/8",
    border: "border-violet-500/60",
    ring: "ring-violet-400",
    dot: "bg-violet-500",
    label: "Purple",
  },
  rose: {
    fill: "bg-rose-500/8",
    border: "border-rose-500/60",
    ring: "ring-rose-400",
    dot: "bg-rose-500",
    label: "Rose",
  },
  slate: {
    fill: "bg-slate-500/8",
    border: "border-slate-500/60",
    ring: "ring-slate-400",
    dot: "bg-slate-500",
    label: "Slate",
  },
};

export const FRAME_COLOR_CLASSES = COLOR_CLASSES;

export interface CanvasFrameNodeData {
  frameId: string;
  name: string;
  color: FrameColor;
  /** True when a regular node is being dragged inside this frame's bounds. */
  isDropTarget?: boolean;
  /** Called when consultant picks a color from the palette popover. */
  onColorChange?: (frameId: string, color: FrameColor) => void;
  /** Called when consultant requests rename via header click. */
  onRename?: (frameId: string) => void;
}

function CanvasFrameNodeComponent({ data, selected }: NodeProps) {
  const frameData = data as unknown as CanvasFrameNodeData;
  const palette = COLOR_CLASSES[frameData.color] ?? COLOR_CLASSES.blue;
  const [colorOpen, setColorOpen] = useState(false);

  const handlePickColor = useCallback(
    (color: FrameColor) => {
      frameData.onColorChange?.(frameData.frameId, color);
      setColorOpen(false);
    },
    [frameData]
  );

  return (
    <>
      {/* Resize handles only visible when frame is selected. */}
      <NodeResizer
        isVisible={selected}
        minWidth={120}
        minHeight={80}
        lineClassName={cn("!border-2", palette.border)}
        handleClassName={cn("!h-2.5 !w-2.5 !rounded-sm !border", palette.border, "!bg-background")}
      />

      <div
        className={cn(
          "relative h-full w-full rounded-lg border-2 transition-all",
          palette.fill,
          palette.border,
          frameData.isDropTarget && "ring-4 ring-offset-2",
          frameData.isDropTarget && palette.ring,
          selected && "shadow-md"
        )}
      >
        {/* Header — name + color picker. */}
        <div className="absolute -top-3 left-3 flex items-center gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              frameData.onRename?.(frameData.frameId);
            }}
            className={cn(
              "flex items-center gap-1.5 rounded-md border bg-background px-2 py-0.5 text-xs font-medium shadow-sm",
              "hover:bg-muted/60 cursor-pointer transition-colors"
            )}
          >
            <span className={cn("h-2 w-2 rounded-full", palette.dot)} aria-hidden />
            <span className="text-foreground">{frameData.name}</span>
          </button>

          <Popover open={colorOpen} onOpenChange={setColorOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-md border bg-background text-muted-foreground shadow-sm",
                  "hover:bg-muted/60 hover:text-foreground transition-colors"
                )}
                aria-label="Frame color"
              >
                <Palette className="h-2.5 w-2.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="start" sideOffset={6}>
              <div className="grid grid-cols-6 gap-1.5">
                {FRAME_COLORS.map((c) => {
                  const cls = COLOR_CLASSES[c];
                  const active = frameData.color === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => handlePickColor(c)}
                      className={cn(
                        "relative flex h-6 w-6 items-center justify-center rounded-md transition-transform hover:scale-110",
                        cls.dot
                      )}
                      aria-label={cls.label}
                      title={cls.label}
                    >
                      {active && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </>
  );
}

export const CanvasFrameNode = memo(CanvasFrameNodeComponent);
CanvasFrameNode.displayName = "CanvasFrameNode";
