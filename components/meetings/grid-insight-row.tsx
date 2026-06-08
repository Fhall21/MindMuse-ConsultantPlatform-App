"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MeetingGridInsight } from "@/app/api/client/meetings/[id]/grid-insights/route";

interface GridInsightRowProps {
  insight: MeetingGridInsight;
  isSelected?: boolean;
  onView: (insight: MeetingGridInsight) => void;
}

export function GridInsightRow({ insight, isSelected = false, onView }: GridInsightRowProps) {
  const displayLabel = insight.editedLabel ?? insight.label;
  const description = insight.description?.trim();

  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm leading-snug">{displayLabel}</span>
        {description ? (
          <span className="line-clamp-2 text-xs leading-5 text-muted-foreground">
            {description}
          </span>
        ) : null}
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
        <Button
          type="button"
          variant={isSelected ? "secondary" : "ghost"}
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => onView(insight)}
        >
          View
        </Button>
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
