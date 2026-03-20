"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SourceTheme } from "@/types/round-detail";

interface SourceThemeCardProps {
  theme: SourceTheme;
  selected?: boolean;
  onSelect?: (themeId: string) => void;
  onDragStart?: (e: React.DragEvent, themeId: string) => void;
  onDragOverCard?: (themeId: string) => void;
  onDragLeaveCard?: () => void;
  onDropOnCard?: (e: React.DragEvent, themeId: string) => void;
  dropTarget?: boolean;
  compact?: boolean;
}

export function SourceThemeCard({
  theme,
  selected,
  onSelect,
  onDragStart,
  onDragOverCard,
  onDragLeaveCard,
  onDropOnCard,
  dropTarget,
  compact,
}: SourceThemeCardProps) {
  return (
    <div
      draggable={!!onDragStart}
      onDragStart={(e) => onDragStart?.(e, theme.id)}
      onDragOver={(e) => {
        if (!onDropOnCard) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        onDragOverCard?.(theme.id);
      }}
      onDragLeave={() => onDragLeaveCard?.()}
      onDrop={(e) => {
        if (!onDropOnCard) return;
        e.preventDefault();
        onDragLeaveCard?.();
        onDropOnCard(e, theme.id);
      }}
      onClick={() => onSelect?.(theme.id)}
      className={cn(
        "rounded-md border px-3 py-2 transition-colors",
        "cursor-grab active:cursor-grabbing",
        selected && "border-primary bg-primary/5 ring-1 ring-primary/20",
        !selected && "hover:bg-accent/50",
        theme.lockedFromSource && "border-l-2 border-l-amber-400",
        dropTarget && "border-primary bg-primary/10 ring-1 ring-primary/30",
      )}
      data-testid="source-theme-card"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm font-medium", compact && "text-xs")}>
            {theme.label}
          </p>
          {!compact && theme.description ? (
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
              {theme.description}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1">
          <Badge
            variant="outline"
            className="h-4 border-amber-200 bg-amber-50 px-1 text-[10px] text-amber-800"
          >
            {theme.sourceConsultationTitle}
          </Badge>
          {theme.lockedFromSource ? (
            <Badge
              variant="outline"
              className="h-4 border-amber-200 bg-amber-50 px-1 text-[10px] text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
              title="This theme was accepted at the consultation level and is locked. It must remain represented in the round."
            >
              Locked
            </Badge>
          ) : null}
          {theme.isUserAdded ? (
            <Badge
              variant="outline"
              className="h-4 border-blue-200 bg-blue-50 px-1 text-[10px] text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300"
            >
              User
            </Badge>
          ) : null}
          {/* Accepted state check - SourceTheme adapter doesn't have acceptedState, so skip this badge */}
          {false ? (
            <Badge
              variant="outline"
              className="h-4 border-emerald-200 bg-emerald-50 px-1 text-[10px] text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
            >
              Accepted
            </Badge>
          ) : null}
        </div>
      </div>
    </div>
  );
}
