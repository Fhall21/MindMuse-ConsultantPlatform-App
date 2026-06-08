"use client";

import Link from "next/link";
import { Check, ExternalLink, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QuoteCard } from "@/components/grid/quote-card";
import type { MeetingGridInsight } from "@/app/api/client/meetings/[id]/grid-insights/route";
import type { GridReviewState } from "@/types/grid";

interface MeetingGridInsightDetailPanelProps {
  insight: MeetingGridInsight | null;
  meetingId: string;
  onReview: (insightId: string, state: GridReviewState, cellId: string) => void;
  onClose?: () => void;
  isReviewing?: boolean;
}

export function MeetingGridInsightDetailPanel({
  insight,
  meetingId,
  onReview,
  onClose,
  isReviewing = false,
}: MeetingGridInsightDetailPanelProps) {
  if (!insight) {
    return (
      <aside className="rounded-lg border border-dashed border-border/80 bg-muted/10 p-4">
        <p className="text-sm font-medium text-muted-foreground">Insight detail</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Click View to inspect evidence without leaving this meeting.
        </p>
      </aside>
    );
  }

  const displayLabel = insight.editedLabel ?? insight.label;
  const description = insight.description?.trim();
  const isAccepted = insight.gridReviewState === "accepted";
  const isRejected = insight.gridReviewState === "rejected";
  const gridHref = `/canvas/round/${insight.consultationId}?tab=grid&cellId=${insight.gridCellId}`;

  return (
    <aside className="sticky top-24 space-y-4 rounded-lg border border-border/70 bg-card p-4">
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Insight detail
          </p>
          <div className="flex items-center gap-1.5">
            <StateBadge state={insight.gridReviewState} />
            {onClose && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
                onClick={onClose}
                aria-label="Close panel"
              >
                <X className="size-3.5" aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold leading-5">{displayLabel}</h3>
          {description ? (
            <p className="text-sm leading-6 text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>

      {insight.connectedColumns.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Related questions
          </p>
          <ul className="space-y-1.5">
            {insight.connectedColumns.map((column) => (
              <li key={column.columnId}>
                <Link
                  href={`${gridHref}&columnId=${column.columnId}`}
                  className="text-xs leading-5 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  {column.question}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Evidence
        </p>
        {insight.quotes.length === 0 ? (
          <p className="text-xs text-muted-foreground">No supporting quotes.</p>
        ) : (
          <div className="space-y-2">
            {insight.quotes.map((quote) => (
              <div key={quote.id} className="space-y-1.5">
                <QuoteCard quote={quote} meetingId={meetingId} />
                <Link
                  href={`/meetings/${meetingId}?highlight=${quote.id}`}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  <ExternalLink className="size-3" aria-hidden="true" />
                  Open quote in transcript
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
        {!isAccepted ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isReviewing}
            className="gap-1.5 border-transparent text-muted-foreground hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
            onClick={() => onReview(insight.id, "accepted", insight.gridCellId)}
          >
            <Check className="size-3.5" aria-hidden="true" />
            Accept
          </Button>
        ) : null}
        {!isRejected ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isReviewing}
            className="gap-1.5 border-transparent text-muted-foreground hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onReview(insight.id, "rejected", insight.gridCellId)}
          >
            <X className="size-3.5" aria-hidden="true" />
            Reject
          </Button>
        ) : null}
        <Button type="button" size="sm" variant="ghost" asChild>
          <Link href={gridHref}>Open grid</Link>
        </Button>
      </div>
    </aside>
  );
}

function StateBadge({ state }: { state: string }) {
  if (state === "accepted" || state === "edited") {
    return (
      <Badge className="bg-green-100 text-green-700 text-xs hover:bg-green-100">
        Accepted
      </Badge>
    );
  }
  if (state === "rejected") {
    return (
      <Badge variant="destructive" className="text-xs">
        Rejected
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-xs">
      Pending
    </Badge>
  );
}
