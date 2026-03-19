"use client";

import Link from "next/link";
import { useReportArtifacts } from "@/hooks/use-reports";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const artifactTypeLabels: Record<string, string> = {
  summary: "Summary",
  report: "Report",
  email: "Email",
};

const artifactTypeBadgeClass: Record<string, string> = {
  summary:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300",
  report:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
  email:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300",
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function ReportList() {
  const { data: artifacts, isLoading, error } = useReportArtifacts();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Generated Reports</CardTitle>
          <CardDescription>Loading report artifacts…</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-md" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Generated Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">
            Failed to load report artifacts. Please try refreshing.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!artifacts || artifacts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Generated Reports</CardTitle>
          <CardDescription>
            Reports are generated from consultation rounds. Go to a round and
            generate a summary, report, or email to see it here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="rounded-md border border-dashed border-border/70 bg-muted/10 p-4 text-center text-sm text-muted-foreground">
            No report artifacts have been generated yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generated Reports</CardTitle>
        <CardDescription>
          Board-pack reports, round summaries, and email drafts generated from
          your consultation rounds.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {artifacts.map((artifact) => (
          <Link
            key={artifact.id}
            href={`/reports/${artifact.id}`}
            className="block rounded-md border border-border/70 bg-background p-4 transition-colors hover:bg-muted/30"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">
                    {artifact.title ?? "Untitled"}
                  </p>
                  <Badge
                    variant="outline"
                    className={
                      artifactTypeBadgeClass[artifact.artifactType] ?? ""
                    }
                  >
                    {artifactTypeLabels[artifact.artifactType] ??
                      artifact.artifactType}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {artifact.roundLabel} · Generated{" "}
                  {formatDate(artifact.generatedAt)}
                </p>
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {artifact.contentPreview}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
