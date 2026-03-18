"use client";

import type { RoundSummaryData } from "@/lib/actions/reports";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface RoundSummaryCardProps {
  summary: RoundSummaryData;
}

function formatConsultationCount(count: number) {
  return `${count} consultation${count === 1 ? "" : "s"}`;
}

export function RoundSummaryCard({ summary }: RoundSummaryCardProps) {
  return (
    <Card className="border-border/70 bg-muted/10">
      <CardHeader>
        <div>
          <CardTitle>Round Summary</CardTitle>
          <CardDescription>
            Accepted round-level themes that can feed summaries, evidence emails,
            and consultation reports.
          </CardDescription>
        </div>
        <CardAction>
          <Badge variant="secondary">
            {formatConsultationCount(summary.linkedConsultationCount)}
          </Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{summary.roundLabel}</Badge>
          <span className="text-xs text-muted-foreground">
            {summary.acceptedThemes.length} accepted theme
            {summary.acceptedThemes.length === 1 ? "" : "s"}
          </span>
          {summary.rejectedThemes.length > 0 ? (
            <span className="text-xs text-muted-foreground">
              {summary.rejectedThemes.length} rejected
            </span>
          ) : null}
        </div>

        {summary.roundDescription ? (
          <p className="text-sm text-muted-foreground">
            {summary.roundDescription}
          </p>
        ) : null}

        {summary.acceptedThemes.length > 0 ? (
          <div className="space-y-2">
            {summary.acceptedThemes.map((theme) => (
              <div
                key={theme.key}
                className="rounded-md border border-border/70 bg-background p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{theme.label}</p>
                  <Badge variant="outline">
                    {formatConsultationCount(theme.provenance.length)}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {theme.provenance
                    .map((entry) => entry.consultationTitle ?? "Untitled consultation")
                    .join(", ")}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-border/70 bg-background/60 p-3 text-sm text-muted-foreground">
            No accepted round themes are available yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
