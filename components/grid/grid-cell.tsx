"use client";

import { memo, type KeyboardEvent, type MouseEvent } from "react";
import { LoaderCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { InsightCandidate } from "@/components/grid/insight-candidate";
import {
  evidenceConfidenceClassName,
  formatEvidenceConfidence,
} from "@/lib/quotes/insight-confidence";
import { cn } from "@/lib/utils";
import type {
  GridCell as GridCellData,
  GridReviewState,
  InsightWithLinks,
} from "@/types/grid";

export interface GridCellProps {
  cell: GridCellData;
  insights: InsightWithLinks[];
  insightsLoading?: boolean;
  isSelected: boolean;
  selectedInsightId: string | null;
  onSelect: () => void;
  onInsightSelect: (insightId: string) => void;
  onInsightReview: (
    insightId: string,
    state: GridReviewState,
    editedText?: string,
    editScope?: "cell" | "all"
  ) => void;
  onRetry?: () => void;
}

function CellFooter({ cell }: { cell: GridCellData }) {
  const quoteLabel = `${cell.quoteCount} ${
    cell.quoteCount === 1 ? "quote" : "quotes"
  }`;

  return (
    <div className="border-t px-3 py-2 text-[11px] leading-4 text-muted-foreground">
      <span>{quoteLabel}</span>
      {cell.confidence ? (
        <span
          className={cn(
            "ml-1.5 text-[10px] font-semibold uppercase tracking-wide",
            evidenceConfidenceClassName(cell.confidence)
          )}
        >
          {formatEvidenceConfidence(cell.confidence)}
        </span>
      ) : null}
    </div>
  );
}

function activateCell(event: KeyboardEvent<HTMLDivElement>, onSelect: () => void) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  onSelect();
}

export const GridCell = memo(function GridCell({
  cell,
  insights,
  insightsLoading = false,
  isSelected,
  selectedInsightId,
  onSelect,
  onInsightSelect,
  onInsightReview,
  onRetry,
}: GridCellProps) {
  const isPreparingCandidates =
    cell.status === "complete" &&
    insights.length === 0 &&
    cell.quoteCount > 0 &&
    (insightsLoading || cell.insightCount === 0);

  function stopCellSelection(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Select analysis cell"
      aria-pressed={isSelected}
      className={cn(
        "relative flex min-h-28 flex-col bg-background text-left outline-none transition-colors hover:bg-muted/20 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        isSelected &&
          "z-10 bg-primary/[0.035] ring-2 ring-inset ring-primary/70 hover:bg-primary/[0.05]"
      )}
      onClick={onSelect}
      onKeyDown={(event) => activateCell(event, onSelect)}
    >
      {cell.status === "generating" && (
        <div className="flex flex-1 flex-col justify-center gap-3 px-3 py-4">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
            Extracting…
          </div>
          <div className="space-y-2" aria-hidden="true">
            <Skeleton className="h-3 w-11/12" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </div>
      )}

      {cell.status === "pending" && (
        <div className="flex flex-1 items-center px-3 py-4 text-xs text-muted-foreground">
          Waiting to extract
        </div>
      )}

      {cell.status === "no_evidence" && (
        <div className="flex flex-1 items-center px-3 py-4 text-xs text-muted-foreground">
          No evidence found
        </div>
      )}

      {cell.status === "failed" && (
        <div className="flex flex-1 items-center justify-between gap-3 px-3 py-4">
          <span className="text-xs text-destructive">Generation failed</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Retry generation"
                disabled={!onRetry}
                onClick={(event) => {
                  stopCellSelection(event);
                  onRetry?.();
                }}
              >
                <RotateCcw aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Retry generation</TooltipContent>
          </Tooltip>
        </div>
      )}

      {cell.status === "complete" && (
        <>
          <div className="flex-1 divide-y">
            {insights.length > 0 ? (
              insights.map((insight) => (
                <InsightCandidate
                  key={insight.junctionId}
                  insight={insight}
                  isSelected={selectedInsightId === insight.id}
                  onSelect={() => onInsightSelect(insight.id)}
                  onAccept={() =>
                    onInsightReview(insight.id, "accepted")
                  }
                  onReject={() =>
                    onInsightReview(insight.id, "rejected")
                  }
                  onEdit={(text, scope) =>
                    onInsightReview(insight.id, "edited", text, scope)
                  }
                />
              ))
            ) : isPreparingCandidates ? (
              <div className="flex flex-col gap-3 px-3 py-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-2 font-medium">
                  <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
                  Preparing insight candidates…
                </div>
                <p>
                  Evidence is grounded. Linking quotes to candidate insights.
                </p>
              </div>
            ) : (
              <div className="px-3 py-4 text-xs text-muted-foreground">
                No insight candidates
              </div>
            )}
          </div>
          <CellFooter cell={cell} />
        </>
      )}
    </div>
  );
});
