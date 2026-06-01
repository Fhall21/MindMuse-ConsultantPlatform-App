"use client";

import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getConfidenceLabel } from "@/lib/insights/confidence";
import { cn } from "@/lib/utils";

export interface ThemeReviewRowProps {
  label: string;
  description?: string | null;
  confidence?: number;
  decision?: "accepted" | "rejected";
  source?: "ai" | "user";
  isBusy?: boolean;
  error?: string | null;
  acceptDisabled?: boolean;
  acceptHelperText?: string;
  onAccept?: () => void;
  onReject?: () => void;
  rejectLabel?: string;
  /** Keep reject (and accept when pending) visible after accept — meeting theme panel. */
  actionsMode?: "hidden-when-decided" | "always";
  className?: string;
}

export function ThemeReviewRow({
  label,
  description,
  confidence,
  decision,
  source = "ai",
  isBusy = false,
  error,
  acceptDisabled = false,
  acceptHelperText,
  onAccept,
  onReject,
  rejectLabel = "Reject",
  actionsMode = "hidden-when-decided",
  className,
}: ThemeReviewRowProps) {
  const isAccepted = decision === "accepted";
  const isRejected = decision === "rejected";
  const confidenceBadge = getConfidenceLabel(confidence);
  const showActions =
    (onAccept || onReject) && (!decision || actionsMode === "always");
  const showAcceptButton = Boolean(onAccept) && !isAccepted;
  const showRejectButton = Boolean(onReject) && (!decision || actionsMode === "always");

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border p-4 transition-all duration-250",
        isAccepted &&
          "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/20",
        isRejected && "border-border/60 bg-muted/20 opacity-90",
        !isAccepted && !isRejected && "border-border/70",
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p
            className={cn(
              "font-medium leading-snug",
              isRejected && "text-muted-foreground line-through"
            )}
          >
            {label}
          </p>
          {description ? (
            <p
              className={cn(
                "text-sm text-muted-foreground",
                isRejected && "line-through"
              )}
            >
              {description}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {source === "user" ? (
            <Badge
              variant="outline"
              className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300"
            >
              User added
            </Badge>
          ) : !isAccepted && !isRejected ? (
            <Badge
              variant="outline"
              className="border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/40 dark:text-violet-300"
            >
              AI suggested
            </Badge>
          ) : null}

          {isAccepted ? (
            <Badge className="border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-200">
              Accepted
            </Badge>
          ) : isRejected ? (
            <Badge variant="outline" className="text-muted-foreground">
              Rejected
            </Badge>
          ) : (
            <Badge variant="outline" className={confidenceBadge.className}>
              {confidenceBadge.label}
            </Badge>
          )}
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {showActions ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {showAcceptButton ? (
            <Button type="button" size="sm" disabled={isBusy || acceptDisabled} onClick={onAccept}>
              {isBusy ? <Loader2 className="size-4 animate-spin" /> : null}
              Accept
            </Button>
          ) : null}
          {showRejectButton ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isBusy}
              onClick={onReject}
            >
              {rejectLabel}
            </Button>
          ) : null}
        </div>
      ) : isAccepted && acceptHelperText ? (
        <p className="mt-3 text-xs text-muted-foreground">{acceptHelperText}</p>
      ) : null}
    </div>
  );
}
