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
        "space-y-3 rounded-lg border px-4 py-4 transition-colors",
        isAccepted && "border-emerald-500/30 bg-emerald-500/5",
        isDismissed && "border-border/60 bg-muted/20 opacity-80",
        !isAccepted && !isDismissed && "border-border/70",
        className
      )}
    >
      <blockquote className="text-[0.9375rem] italic leading-relaxed text-foreground">
        {contextBefore && <span className="text-muted-foreground">{contextBefore}</span>}
        <span className="bg-amber-200/50 dark:bg-amber-500/20 px-1 rounded-sm mx-1 text-foreground">
          &ldquo;{text}&rdquo;
        </span>
        {contextAfter && <span className="text-muted-foreground">{contextAfter}</span>}
      </blockquote>

      {justification && (
        <div className="border-l-2 border-border/60 pl-3 text-xs italic text-muted-foreground">
          {justification}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {[speaker, positionLabel, "AI suggested"].filter(Boolean).join(" · ")}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge variant="outline" className="max-w-[12rem] truncate">
          {themeLabel}
        </Badge>
        {isAccepted ? (
          <Badge className="border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-200">
            Saved
          </Badge>
        ) : isDismissed ? (
          <Badge variant="outline" className="text-muted-foreground">
            Dismissed
          </Badge>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {showActions ? (
        <div className="flex flex-wrap gap-2 border-t border-border/60 pt-3">
          {onAccept ? (
            <Button type="button" size="sm" disabled={isBusy} onClick={onAccept}>
              {isBusy ? <Loader2 className="size-4 animate-spin" /> : null}
              Accept
            </Button>
          ) : null}
          {onDismiss ? (
            <Button type="button" size="sm" variant="outline" disabled={isBusy} onClick={onDismiss}>
              Dismiss
            </Button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
