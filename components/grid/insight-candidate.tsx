"use client";

import { memo, type MouseEvent } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  evidenceConfidenceClassName,
  formatEvidenceConfidence,
} from "@/lib/quotes/insight-confidence";
import { cn } from "@/lib/utils";
import type { InsightWithLinks } from "@/types/grid";

export interface InsightCandidateProps {
  insight: InsightWithLinks;
  isSelected: boolean;
  onSelect: () => void;
  onAccept: () => void;
  onReject: () => void;
  onEdit?: (text: string, scope: "cell" | "all") => void;
}

function stopCellSelection(event: MouseEvent<HTMLButtonElement>) {
  event.stopPropagation();
}

export const InsightCandidate = memo(function InsightCandidate({
  insight,
  isSelected,
  onSelect,
  onAccept,
  onReject,
}: InsightCandidateProps) {
  const displayLabel = insight.editedLabel ?? insight.label;
  const isAccepted = insight.gridReviewState === "accepted";
  const isRejected = insight.gridReviewState === "rejected";
  const quoteCount = insight.quotes.length;
  const quoteLabel = `${quoteCount} ${quoteCount === 1 ? "quote" : "quotes"}`;
  const description = insight.description?.trim();

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "group/insight flex min-w-0 cursor-pointer items-start gap-2 px-3 py-2.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        isSelected &&
          "bg-primary/[0.035] ring-2 ring-inset ring-primary/70",
        isAccepted && "bg-emerald-50/70 dark:bg-emerald-950/20",
        isRejected && "bg-muted/35 opacity-60"
      )}
      data-review-state={insight.gridReviewState}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.stopPropagation();
        onSelect();
      }}
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
        {description ? (
          <p
            className={cn(
              "mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground",
              isRejected && "line-through"
            )}
          >
            {description}
          </p>
        ) : null}
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] leading-4 text-muted-foreground">
          <span>{quoteLabel}</span>
          {insight.quoteConfidence ? (
            <span
              className={cn(
                "text-[10px] font-semibold uppercase tracking-wide",
                evidenceConfidenceClassName(insight.quoteConfidence)
              )}
            >
              {formatEvidenceConfidence(insight.quoteConfidence)}
            </span>
          ) : null}
          {isAccepted && (
            <span className="text-[10px] text-emerald-700 dark:text-emerald-300">
              Accepted
            </span>
          )}
          {isRejected && (
            <span className="text-[10px] text-muted-foreground">Rejected</span>
          )}
        </div>
      </div>

      <div className="flex w-14 shrink-0 items-center justify-end gap-0.5">
        <div className="flex size-6 items-center justify-center">
          {!isAccepted ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="border border-transparent text-muted-foreground opacity-0 transition-opacity hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 group-hover/insight:opacity-100 focus-visible:opacity-100 dark:hover:border-emerald-900/60 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
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
          ) : null}
        </div>

        <div className="flex size-6 items-center justify-center">
          {!isRejected ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="border border-transparent text-muted-foreground opacity-0 transition-opacity hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive group-hover/insight:opacity-100 focus-visible:opacity-100"
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
          ) : null}
        </div>
      </div>
    </div>
  );
});
