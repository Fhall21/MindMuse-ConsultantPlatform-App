"use client";

import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ChatQuoteReviewRowProps {
  text: string;
  speaker?: string | null;
  positionLabel: string;
  themeLabel: string;
  justification?: string;
  contextBefore?: string;
  contextAfter?: string;
  decision?: "accepted" | "dismissed";
  isBusy?: boolean;
  error?: string | null;
  onAccept?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function ChatQuoteReviewRow({
  text,
  speaker,
  positionLabel,
  themeLabel,
  justification,
  contextBefore,
  contextAfter,
  decision,
  isBusy = false,
  error,
  onAccept,
  onDismiss,
  className,
}: ChatQuoteReviewRowProps) {
  const isAccepted = decision === "accepted";
  const isDismissed = decision === "dismissed";
  const showActions = !decision && (onAccept || onDismiss);

  return (
    <article
      className={cn(
        "rounded-md border border-border bg-card p-3 transition-colors",
        className
      )}
    >
      <div className="mb-1.5 text-[0.6125rem] font-semibold uppercase tracking-widest text-muted-foreground">
        {speaker || "Unknown"}
      </div>

      <blockquote className="mb-2 line-clamp-4 text-[0.8125rem] leading-relaxed text-muted-foreground">
        {contextBefore}
        <span
          className={cn(
            "rounded-sm bg-opacity-60 px-0.5 text-foreground",
            isAccepted
              ? "bg-green-200 dark:bg-green-500/20"
              : isDismissed
                ? "bg-muted"
                : "bg-amber-200 dark:bg-amber-500/20"
          )}
        >
          {text}
        </span>
        {contextAfter}
      </blockquote>

      {justification && (
        <div className="mb-2 border-t border-border pt-1.5 text-xs italic text-muted-foreground">
          {justification}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <p>{[positionLabel, "AI suggested"].filter(Boolean).join(" · ")}</p>
        <Badge variant="outline" className="max-w-[12rem] truncate rounded-sm">
          {themeLabel}
        </Badge>
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {showActions ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {onAccept ? (
            <Button
              type="button"
              size="sm"
              className="h-7 px-2.5 text-xs"
              disabled={isBusy}
              onClick={onAccept}
            >
              {isBusy ? <Loader2 className="size-4 animate-spin" /> : null}
              Accept
            </Button>
          ) : null}
          {onDismiss ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2.5 text-xs"
              disabled={isBusy}
              onClick={onDismiss}
            >
              Dismiss
            </Button>
          ) : null}
        </div>
      ) : isAccepted ? (
        <Badge className="mt-2 rounded-sm border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-200">
          Saved
        </Badge>
      ) : isDismissed ? (
        <Badge variant="outline" className="mt-2 rounded-sm text-muted-foreground">
          Dismissed
        </Badge>
      ) : null}
    </article>
  );
}
