"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AuditTrailSection,
  DraftGroupsSection,
  EvidenceSection,
  GraphNodesSection,
  GraphOverviewSection,
  NetworkDiagramSection,
  QuickStats,
  ReportContent,
  ThemeHierarchySection,
} from "@/components/reports/report-view";
import { ReportCoverPage, deriveMatterRef } from "@/components/reports/report-cover-page";
import { fetchJson } from "@/hooks/api";
import type { ReportArtifactDetail } from "@/lib/actions/reports";
import { buildReportGraphModel } from "@/lib/report-graph";
import { formatDate, estimateReadTime } from "@/lib/report-formatting";
import type { PublicReportShareMetadata } from "@/types/report-share";

const artifactTypeLabels: Record<string, string> = {
  summary: "Consultation Summary",
  report: "Board-Pack Report",
  email: "Evidence Email",
};

interface SharedReportPageProps {
  token: string;
}

export function SharedReportPage({ token }: SharedReportPageProps) {
  const [metadata, setMetadata] = useState<PublicReportShareMetadata | null>(null);
  const [report, setReport] = useState<ReportArtifactDetail | null>(null);
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUnlocking, setIsUnlocking] = useState(false);

  useEffect(() => {
    let isMounted = true;

    void fetchJson<PublicReportShareMetadata>(`/api/share/${token}`)
      .then((payload) => {
        if (!isMounted) {
          return;
        }

        setMetadata(payload);
      })
      .catch((loadError) => {
        if (!isMounted) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Failed to load share link.");
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  const graphModel = useMemo(() => {
    if (!report) {
      return null;
    }

    return buildReportGraphModel(report.inputSnapshot);
  }, [report]);

  async function handleUnlock(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsUnlocking(true);
    setError(null);

    try {
      const payload = await fetchJson<ReportArtifactDetail>(`/api/share/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      setReport(payload);
    } catch (unlockError) {
      setError(
        unlockError instanceof Error
          ? unlockError.message
          : "Failed to unlock shared report."
      );
    } finally {
      setIsUnlocking(false);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!metadata) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-border/60 bg-card p-6 text-sm text-muted-foreground shadow-xs ring-1 ring-foreground/10">
        {error ?? "This share link is unavailable."}
      </div>
    );
  }

  if (!report) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <div className="rounded-xl border border-border/60 bg-card p-6 shadow-xs ring-1 ring-foreground/10">
          <div className="space-y-3">
            <Badge variant="outline">Shared report</Badge>
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {metadata.reportTitle ?? "Shared report"}
              </h1>
              <p className="text-sm text-muted-foreground">
                Intended for {metadata.consultantName || metadata.consultantEmailHint}.
              </p>
              <p className="text-sm text-muted-foreground">
                Expires {formatDate(metadata.expiresAt)}.
              </p>
            </div>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleUnlock}>
            <div className="space-y-2">
              <label htmlFor="share-passcode" className="text-sm font-medium text-foreground">
                Share passcode
              </label>
              <Input
                id="share-passcode"
                type="password"
                value={passcode}
                onChange={(event) => setPasscode(event.target.value)}
                autoComplete="one-time-code"
                placeholder="Enter passcode"
                disabled={isUnlocking}
              />
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <Button type="submit" disabled={isUnlocking || passcode.trim().length === 0}>
              {isUnlocking ? "Unlocking..." : "Unlock report"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  const consultationCount = report.consultations.length || report.consultationTitles.length;
  const readTime = estimateReadTime(report.content);

  return (
    <div className="relative mx-auto max-w-4xl space-y-8 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="rotate-[-28deg] text-[6rem] font-semibold tracking-[0.6rem] text-foreground/5 sm:text-[9rem]">
          SHARED
        </span>
      </div>

      <ReportCoverPage
        title={report.title}
        roundLabel={report.roundLabel}
        generatedAt={report.generatedAt}
        matterRef={deriveMatterRef(report.id)}
        consultationCount={consultationCount}
      />

      <header className="relative space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            {artifactTypeLabels[report.artifactType] ?? report.artifactType}
          </Badge>
          <Badge variant="secondary">{report.roundLabel}</Badge>
          <Badge variant="outline">Shared access</Badge>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">~{readTime} min read</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            {report.title ?? "Untitled Report"}
          </h1>
        </div>

        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span>Generated {formatDate(report.generatedAt)}</span>
          <span>
            {consultationCount} meeting{consultationCount === 1 ? "" : "s"}
          </span>
          <span>
            {report.acceptedThemeCount} accepted theme{report.acceptedThemeCount === 1 ? "" : "s"}
          </span>
        </div>
      </header>

      <QuickStats report={report} />

      <Separator />

      <article className="relative min-w-0 space-y-8">
        <ReportContent content={report.content} />

        <Separator />

        {graphModel ? (
          <>
            <GraphOverviewSection graphModel={graphModel} />
            <Separator />
            <NetworkDiagramSection graphModel={graphModel} template="standard" />
            <Separator />
            <GraphNodesSection graphModel={graphModel} template="standard" />
          </>
        ) : (
          <ThemeHierarchySection report={report} template="standard" />
        )}

        {report.draftThemeGroups && report.draftThemeGroups.length > 0 ? (
          <>
            <Separator />
            <DraftGroupsSection report={report} />
          </>
        ) : null}

        <Separator />
        <EvidenceSection report={report} />
        <Separator />
        <AuditTrailSection report={report} />
      </article>
    </div>
  );
}