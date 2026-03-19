"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useReportArtifact,
  useReportArtifactVersions,
} from "@/hooks/use-reports";
import type { ReportArtifactDetail } from "@/lib/actions/reports";

// ─── Helpers ────────────────────────────────────────────────────────────────

const artifactTypeLabels: Record<string, string> = {
  summary: "Round Summary",
  report: "Board-Pack Report",
  email: "Evidence Email",
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

// ─── Content renderer ───────────────────────────────────────────────────────

/**
 * Renders report content with minimal formatting.
 * Splits on double-newlines for paragraphs, and detects markdown-style
 * headings (## / ###) for section structure.
 */
function ReportContent({ content }: { content: string }) {
  const blocks = content.split(/\n{2,}/);

  return (
    <div className="space-y-4">
      {blocks.map((block, i) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        // Markdown heading detection
        if (trimmed.startsWith("### ")) {
          return (
            <h4
              key={i}
              className="pt-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {trimmed.slice(4)}
            </h4>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h3 key={i} className="pt-3 text-base font-semibold text-foreground">
              {trimmed.slice(3)}
            </h3>
          );
        }
        if (trimmed.startsWith("# ")) {
          return (
            <h2 key={i} className="pt-4 text-lg font-semibold text-foreground">
              {trimmed.slice(2)}
            </h2>
          );
        }

        // Bullet list detection
        const lines = trimmed.split("\n");
        const isBulletList = lines.every(
          (line) =>
            line.trim().startsWith("- ") ||
            line.trim().startsWith("• ") ||
            line.trim().startsWith("* ") ||
            line.trim() === ""
        );

        if (isBulletList) {
          return (
            <ul key={i} className="list-inside list-disc space-y-1 pl-1 text-sm leading-relaxed text-foreground/90">
              {lines
                .filter((line) => line.trim())
                .map((line, j) => (
                  <li key={j}>{line.replace(/^[\s]*[-•*]\s*/, "")}</li>
                ))}
            </ul>
          );
        }

        // Regular paragraph
        return (
          <p key={i} className="text-sm leading-relaxed text-foreground/90">
            {trimmed}
          </p>
        );
      })}
    </div>
  );
}

// ─── Provenance section ─────────────────────────────────────────────────────

function ProvenanceSection({ report }: { report: ReportArtifactDetail }) {
  const inputThemes = report.inputSnapshot.accepted_round_themes as
    | Array<{ label: string; description?: string | null }>
    | undefined;
  const supportingThemes =
    report.inputSnapshot.supporting_consultation_themes as
      | Array<{
          label: string;
          description?: string | null;
          consultation_title?: string | null;
        }>
      | undefined;

  return (
    <div className="space-y-6">
      {/* Source consultations */}
      {report.consultationTitles.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Source Consultations
          </h3>
          <div className="grid gap-1.5">
            {report.consultationTitles.map((title, i) => (
              <div
                key={i}
                className="rounded-md border border-border/60 bg-muted/10 px-3 py-2 text-sm"
              >
                {title}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Accepted round themes */}
      {inputThemes && inputThemes.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Accepted Round Themes ({inputThemes.length})
          </h3>
          <div className="grid gap-1.5">
            {inputThemes.map((theme, i) => (
              <div
                key={i}
                className="rounded-md border border-border/60 bg-muted/10 px-3 py-2"
              >
                <p className="text-sm font-medium">{theme.label}</p>
                {theme.description && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {theme.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Supporting consultation themes */}
      {supportingThemes && supportingThemes.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Supporting Consultation Themes ({supportingThemes.length})
          </h3>
          <div className="grid gap-1.5">
            {supportingThemes.map((theme, i) => (
              <div
                key={i}
                className="rounded-md border border-border/60 bg-muted/10 px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{theme.label}</p>
                  {theme.consultation_title && (
                    <Badge variant="outline" className="text-[10px]">
                      {theme.consultation_title}
                    </Badge>
                  )}
                </div>
                {theme.description && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {theme.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Version history sidebar ────────────────────────────────────────────────

function VersionHistory({
  report,
  currentId,
}: {
  report: ReportArtifactDetail;
  currentId: string;
}) {
  const { data: versions } = useReportArtifactVersions(
    report.roundId,
    report.artifactType
  );

  if (!versions || versions.length <= 1) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Version History
      </h3>
      <div className="space-y-1">
        {versions.map((version, index) => (
          <Link
            key={version.id}
            href={`/reports/${version.id}`}
            className={`block rounded-md border px-3 py-2 text-xs transition-colors ${
              version.id === currentId
                ? "border-primary/40 bg-primary/5 font-medium"
                : "border-border/60 hover:bg-muted/20"
            }`}
          >
            <span className="text-muted-foreground">
              v{versions.length - index}
            </span>{" "}
            · {formatShortDate(version.generatedAt)}
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Main report view ───────────────────────────────────────────────────────

interface ReportViewProps {
  artifactId: string;
}

export function ReportView({ artifactId }: ReportViewProps) {
  const { data: report, isLoading, error } = useReportArtifact(artifactId);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <p className="text-sm text-destructive">
          {error
            ? "Failed to load report. Please try refreshing."
            : "Report not found. It may have been deleted or you may not have access."}
        </p>
        <Button variant="ghost" asChild>
          <Link href="/reports">Back to reports</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Navigation */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/reports" className="hover:text-foreground transition-colors">
          Reports
        </Link>
        <span>/</span>
        <span className="text-foreground">
          {report.title ?? "Untitled"}
        </span>
      </div>

      {/* ─── Report header ─── */}
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            {artifactTypeLabels[report.artifactType] ?? report.artifactType}
          </Badge>
          <Badge variant="secondary">{report.roundLabel}</Badge>
          {report.totalVersions > 1 && (
            <Badge variant="outline" className="text-[10px]">
              v{report.versionNumber} of {report.totalVersions}
            </Badge>
          )}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {report.title ?? "Untitled Report"}
        </h1>
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span>Generated {formatDate(report.generatedAt)}</span>
          {report.consultationTitles.length > 0 && (
            <span>
              {report.consultationTitles.length} consultation
              {report.consultationTitles.length === 1 ? "" : "s"}
            </span>
          )}
          <span>
            {report.acceptedThemeCount} accepted theme
            {report.acceptedThemeCount === 1 ? "" : "s"}
          </span>
          {report.supportingThemeCount > 0 && (
            <span>
              {report.supportingThemeCount} supporting theme
              {report.supportingThemeCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
        {report.roundDescription && (
          <p className="text-sm text-muted-foreground">
            {report.roundDescription}
          </p>
        )}
      </header>

      <Separator />

      {/* ─── Report body + sidebar layout ─── */}
      <div className="grid gap-8 lg:grid-cols-[1fr_260px]">
        {/* Main content */}
        <article className="min-w-0 space-y-6">
          <ReportContent content={report.content} />
        </article>

        {/* Sidebar */}
        <aside className="space-y-6">
          <VersionHistory report={report} currentId={artifactId} />
          <ProvenanceSection report={report} />
        </aside>
      </div>

      {/* ─── Footer metadata ─── */}
      <Separator />

      <footer className="space-y-2 pb-8 text-xs text-muted-foreground">
        <p>
          Report artifact ID: <code className="text-[10px]">{report.id}</code>
        </p>
        <p>
          Round:{" "}
          <Link
            href={`/consultations/rounds/${report.roundId}`}
            className="underline hover:text-foreground transition-colors"
          >
            {report.roundLabel}
          </Link>
        </p>
        <p>Generated {formatDate(report.generatedAt)}</p>
        {report.totalVersions > 1 && (
          <p>
            Version {report.versionNumber} of {report.totalVersions} — each
            regeneration creates a new version; previous versions are preserved.
          </p>
        )}
      </footer>
    </div>
  );
}
