"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { MeetingGridInsight } from "@/app/api/client/meetings/[id]/grid-insights/route";

interface GridInsightRowProps {
  insight: MeetingGridInsight;
}

export function GridInsightRow({ insight }: GridInsightRowProps) {
  const displayLabel = insight.editedLabel ?? insight.label;

  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm leading-snug">{displayLabel}</span>
        {insight.question && (
          <span className="text-xs text-muted-foreground line-clamp-1">
            {insight.question}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <StateBadge state={insight.gridReviewState} />
        {insight.accepted && (
          <Badge variant="default" className="text-xs">
            On canvas
          </Badge>
        )}
        {insight.consultationId ? (
          <Link
            href={`/canvas/round/${insight.consultationId}?tab=grid`}
            className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            View →
          </Link>
        ) : null}
      </div>
    </div>
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
