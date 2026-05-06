"use client";

import { GitBranch, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CANVAS_CLUTTER_THRESHOLD } from "@/types/canvas";

interface CanvasClutterBannerProps {
  nodeCount: number;
  onCreateFrame: () => void;
  onDismiss: () => void;
}

export function CanvasClutterBanner({
  nodeCount,
  onCreateFrame,
  onDismiss,
}: CanvasClutterBannerProps) {
  if (nodeCount < CANVAS_CLUTTER_THRESHOLD) return null;

  return (
    <div className="flex shrink-0 items-center gap-3 border-b bg-amber-50/70 px-4 py-2 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
      <GitBranch className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
      <p className="flex-1 text-xs">
        <span className="font-medium">{nodeCount} nodes</span>
        {" — this canvas is getting dense. Create a frame to isolate a curated view."}
      </p>
      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCreateFrame}
          className="h-6 px-2.5 text-xs font-medium text-amber-800 hover:bg-amber-100 hover:text-amber-900 dark:text-amber-300 dark:hover:bg-amber-900/40"
        >
          Create a frame
        </Button>
        <button
          onClick={onDismiss}
          className="flex h-5 w-5 items-center justify-center rounded text-amber-600 transition-colors hover:bg-amber-100 hover:text-amber-900 dark:text-amber-400 dark:hover:bg-amber-900/40"
          aria-label="Dismiss"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
