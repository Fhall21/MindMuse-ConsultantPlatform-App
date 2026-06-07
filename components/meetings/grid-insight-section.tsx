"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMeetingGridInsights } from "@/hooks/use-meeting-grid-insights";
import { GridInsightRow } from "./grid-insight-row";

interface GridInsightSectionProps {
  meetingId: string;
}

export function GridInsightSection({ meetingId }: GridInsightSectionProps) {
  const [show, setShow] = useState(true);
  const { data, isLoading, isError } = useMeetingGridInsights(meetingId);
  const insights = data?.insights ?? [];

  return (
    <div className="space-y-2 pt-1">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Grid insights
        </p>
        {insights.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground"
            onClick={() => setShow((v) => !v)}
          >
            {show ? "Hide" : "Show"}
          </Button>
        )}
      </div>

      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-3/4" />
        </div>
      )}

      {isError && (
        <p className="text-xs text-muted-foreground">
          Could not load grid insights.
        </p>
      )}

      {!isLoading && !isError && insights.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No grid analysis run for this meeting yet.
        </p>
      )}

      {!isLoading && !isError && show && insights.length > 0 && (
        <div className="divide-y">
          {insights.map((insight) => (
            <GridInsightRow key={insight.id} insight={insight} />
          ))}
        </div>
      )}
    </div>
  );
}
