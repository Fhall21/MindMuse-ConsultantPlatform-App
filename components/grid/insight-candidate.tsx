"use client";

import { memo, type MouseEvent } from "react";
import { Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { InsightWithLinks } from "@/types/grid";

export interface InsightCandidateProps {
  insight: InsightWithLinks;
  onAccept: () => void;
  onReject: () => void;
  onEdit?: (text: string, scope: "cell" | "all") => void;
}

function stopCellSelection(event: MouseEvent<HTMLButtonElement>) {
  event.stopPropagation();
}

export const InsightCandidate = memo(function InsightCandidate({
  insight,
  onAccept,
  onReject,
}: InsightCandidateProps) {
  const displayLabel = insight.editedLabel ?? insight.label;
  const isAccepted = insight.gridReviewState === "accepted";
  const isRejected = insight.gridReviewState === "rejected";

  return (
    <div
      className={cn(
        "group/insight flex min-w-0 items-start gap-2 px-3 py-2.5 transition-colors",
        isAccepted &&
          "bg-emerald-50/70 dark:bg-emerald-950/20",
        isRejected && "bg-muted/35 opacity-60"
      )}
      data-review-state={insight.gridReviewState}
    >
      <span
        className={cn(
          "mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/45",
          isAccepted && "bg-emerald-600 dark:bg-emerald-400"
        )}
        aria-hidden="true"
      />

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm leading-5 text-foreground",
            isRejected && "text-muted-foreground line-through"
          )}
        >
          {displayLabel}
        </p>
        {isAccepted && (
          <Badge
            variant="outline"
            className="mt-1.5 border-emerald-200 bg-emerald-100/80 text-[10px] text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-200"
          >
            Accepted
          </Badge>
        )}
        {isRejected && (
          <Badge variant="outline" className="mt-1.5 text-[10px] text-muted-foreground">
            Rejected
          </Badge>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {!isAccepted && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="border border-transparent text-muted-foreground hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:border-emerald-900/60 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
                aria-label={`Accept insight: ${displayLabel}`}
                onClick={(event) => {
                  stopCellSelection(event);
                  onAccept();
                }}
              >
                <Check aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Accept insight</TooltipContent>
          </Tooltip>
        )}

        {!isRejected && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="border border-transparent text-muted-foreground hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                aria-label={`Reject insight: ${displayLabel}`}
                onClick={(event) => {
                  stopCellSelection(event);
                  onReject();
                }}
              >
                <X aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reject insight</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
});
