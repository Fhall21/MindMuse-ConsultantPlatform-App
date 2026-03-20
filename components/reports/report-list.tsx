"use client";

import Link from "next/link";
import { useReportArtifacts } from "@/hooks/use-reports";
import { Badge } from "@/components/ui/badge";
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
      <section className="space-y-4 border-t border-border/80 pt-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">Generated outputs</h2>
          <p className="text-sm text-muted-foreground">Loading artifacts…</p>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-md" />
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="space-y-4 border-t border-border/80 pt-4">
        <h2 className="text-lg font-semibold tracking-tight">Generated outputs</h2>
        <p className="text-sm text-destructive">
          Failed to load report artifacts. Please try refreshing.
        </p>
      </section>
    );
  }

  if (!artifacts || artifacts.length === 0) {
    return (
      <section className="space-y-3 border-t border-border/80 pt-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">Generated outputs</h2>
          <p className="text-sm text-muted-foreground">
            Generate a round summary, report, or email to see it here.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">No outputs yet.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4 border-t border-border/80 pt-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">Generated outputs</h2>
        <p className="text-sm text-muted-foreground">
          Reports, summaries, and email drafts.
        </p>
      </div>
      <div className="space-y-1">
        {artifacts.map((artifact) => (
          <Link
            key={artifact.id}
            href={`/reports/${artifact.id}`}
            className="block rounded-md border border-transparent px-1 py-3 transition-colors hover:bg-muted/30"
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
      </div>
    </section>
  );
}
