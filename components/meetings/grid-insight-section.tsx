"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMeetingGridInsights } from "@/hooks/use-meeting-grid-insights";
import { useReviewInsight } from "@/hooks/use-review-insight";
import type { GridReviewState } from "@/types/grid";
import type { MeetingGridInsight } from "@/app/api/client/meetings/[id]/grid-insights/route";
import { cn } from "@/lib/utils";
import { GridInsightRow } from "./grid-insight-row";
import { MeetingGridInsightDetailPanel } from "./meeting-grid-insight-detail-panel";

interface GridInsightSectionProps {
  meetingId: string;
}

export function GridInsightSection({ meetingId }: GridInsightSectionProps) {
  const [show, setShow] = useState(true);
  const [selectedInsightId, setSelectedInsightId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useMeetingGridInsights(meetingId);
  const insights = useMemo(() => data?.insights ?? [], [data?.insights]);
  const selectedInsight =
    insights.find((insight) => insight.id === selectedInsightId) ?? null;
  const reviewInsight = useReviewInsight(selectedInsight?.consultationId ?? "");

  const groups = useMemo(() => {
    const byQuestion = new Map<string, MeetingGridInsight[]>();
    for (const insight of insights) {
      const question = insight.question?.trim() || "Question not linked";
      byQuestion.set(question, [...(byQuestion.get(question) ?? []), insight]);
    }
    return Array.from(byQuestion.entries()).map(([question, questionInsights]) => ({
      question,
      insights: questionInsights,
    }));
  }, [insights]);

  function handleReview(
    insightId: string,
    state: GridReviewState,
    cellId: string
  ) {
    reviewInsight.mutate(
      { insightId, state, cellId },
      {
        onSettled: () => {
          queryClient.invalidateQueries({
            queryKey: ["meeting-grid-insights", meetingId],
          });
          queryClient.invalidateQueries({
            queryKey: ["themes", "meeting", meetingId],
          });
        },
      }
    );
  }

  return (
    <div className="space-y-3 pt-1">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Grid insights by question
        </p>
        {insights.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground"
            onClick={() => {
              if (show) setSelectedInsightId(null);
              setShow((v) => !v);
            }}
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
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
          <div className="space-y-2">
            {groups.map((group, index) => (
              <details
                key={group.question}
                className="group rounded-lg border border-border/60 bg-card/40"
                open={index === 0}
                onToggle={(e) => {
                  if (!(e.currentTarget as HTMLDetailsElement).open) {
                    if (group.insights.some((i) => i.id === selectedInsightId)) {
                      setSelectedInsightId(null);
                    }
                  }
                }}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium">
                  <span className="line-clamp-2">{group.question}</span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                    {group.insights.length}
                    <ChevronDown
                      className="size-3.5 transition-transform group-open:rotate-180"
                      aria-hidden="true"
                    />
                  </span>
                </summary>
                <div className="divide-y border-t border-border/60 px-3">
                  {group.insights.map((insight) => (
                    <GridInsightRow
                      key={`${insight.gridCellId}-${insight.id}`}
                      insight={insight}
                      isSelected={selectedInsightId === insight.id}
                      onView={(next) =>
                        setSelectedInsightId(
                          next.id === selectedInsightId ? null : next.id
                        )
                      }
                    />
                  ))}
                </div>
              </details>
            ))}
          </div>
          <div className={cn(!selectedInsight && "lg:pt-0")}>
            <MeetingGridInsightDetailPanel
              insight={selectedInsight}
              meetingId={meetingId}
              onReview={handleReview}
              onClose={() => setSelectedInsightId(null)}
              isReviewing={reviewInsight.isPending}
            />
          </div>
        </div>
      )}
    </div>
  );
}
