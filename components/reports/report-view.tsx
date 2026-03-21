"use client";

import React, { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useReportArtifact,
  useReportArtifactVersions,
} from "@/hooks/use-reports";
import type { ReportArtifactDetail, ConsultationMeta } from "@/lib/actions/reports";
import {
  formatDate,
  formatShortDate,
  estimateReadTime,
} from "@/lib/report-formatting";
import {
  buildReportGraphModel,
  formatConnectionTypeLabel,
  type ReportGraphModel,
} from "@/lib/report-graph";
import {
  filterMajorEvents,
  clusterAuditEvents,
  getAuditDotColor,
  type AuditCluster,
} from "@/lib/report-audit";
import { cn } from "@/lib/utils";
import { ReportCoverPage, deriveMatterRef } from "@/components/reports/report-cover-page";
import { toast } from "sonner";

// ─── Constants ───────────────────────────────────────────────────────────────

const artifactTypeLabels: Record<string, string> = {
  summary: "Round Summary",
  report: "Board-Pack Report",
  email: "Evidence Email",
};

type ReportTemplate = "standard" | "executive";

// ─── Copy helper ─────────────────────────────────────────────────────────────

function CopyButton({ text, label }: { text: string; label?: string }) {
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(label ? `Copied: ${label}` : "Copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  }, [text, label]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="copy-button inline-flex items-center justify-center rounded p-1 text-muted-foreground/50 transition-colors hover:bg-muted/40 hover:text-muted-foreground print:hidden"
      title="Copy to clipboard"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
      </svg>
    </button>
  );
}

// ─── Quick Stats ─────────────────────────────────────────────────────────────

function QuickStats({ report }: { report: ReportArtifactDetail }) {
  const readTime = estimateReadTime(report.content);
  const consultationCount = report.consultations.length || report.consultationTitles.length;

  const stats = [
    {
      label: "Consultations",
      value: consultationCount,
    },
    {
      label: "Accepted Themes",
      value: report.acceptedThemeCount,
    },
    {
      label: "Supporting Themes",
      value: report.supportingThemeCount,
    },
    {
      label: "Reading Time",
      value: `~${readTime} min`,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-lg border border-border/60 bg-gradient-to-br from-muted/30 to-background px-4 py-3"
        >
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {stat.label}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Findings Section ────────────────────────────────────────────────────────

function GraphOverviewSection({
  graphModel,
}: {
  graphModel: ReportGraphModel;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Evidence Network
        </h3>
        <p className="text-xs text-muted-foreground">
          Snapshot saved {formatDate(graphModel.snapshot.snapshotAt)}
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-border/60 bg-gradient-to-br from-muted/30 to-background px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Nodes
          </p>
          <p className="mt-1 text-xl font-semibold text-foreground">
            {graphModel.nodeCount}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {graphModel.acceptedThemeCount} groups · {graphModel.supportingThemeCount} source themes
          </p>
        </div>
        <div className="rounded-lg border border-border/60 bg-gradient-to-br from-muted/30 to-background px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Connections
          </p>
          <p className="mt-1 text-xl font-semibold text-foreground">
            {graphModel.connectionCount}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {graphModel.connectionsByType.length} relationship type
            {graphModel.connectionsByType.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="rounded-lg border border-border/60 bg-gradient-to-br from-muted/30 to-background px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Layout
          </p>
          <p className="mt-1 text-xl font-semibold text-foreground">
            {Math.max(graphModel.snapshot.layoutState.length - 1, 0)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            saved node positions
          </p>
        </div>
      </div>
    </section>
  );
}

function GraphConnectionsSection({
  graphModel,
  template,
}: {
  graphModel: ReportGraphModel;
  template: ReportTemplate;
}) {
  const groupsToShow =
    template === "executive"
      ? graphModel.connectionsByType
          .map((group) => ({
            ...group,
            connections: group.connections.slice(0, 2),
          }))
          .filter((group) => group.connections.length > 0)
          .slice(0, 2)
      : graphModel.connectionsByType;

  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Network Connections ({graphModel.connectionCount})
      </h3>
      {groupsToShow.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 bg-muted/5 px-4 py-4 text-sm text-muted-foreground">
          No saved typed connections were available on this artifact. The snapshot still preserves
          the network nodes and can be enriched by later canvas-aware generations.
        </div>
      ) : (
        <div className="space-y-3">
          {groupsToShow.map((group) => (
            <div
              key={group.type}
              className="rounded-lg border border-border/50 bg-muted/5 px-4 py-4"
            >
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-medium text-foreground">{group.label}</h4>
                <Badge variant="outline" className="text-[10px]">
                  {group.connections.length}
                </Badge>
              </div>
              <div className="mt-3 space-y-2">
                {group.connections.map((connection) => (
                  <div
                    key={connection.key}
                    className="rounded-md border border-border/50 bg-background px-3 py-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {connection.fromLabel}
                      </p>
                      <Badge variant="secondary" className="text-[10px] uppercase">
                        {formatConnectionTypeLabel(connection.connectionType)}
                      </Badge>
                      <p className="text-sm font-medium text-foreground">
                        {connection.toLabel}
                      </p>
                      <Badge variant="outline" className="text-[10px]">
                        {connection.origin === "ai_suggested" ? "AI accepted" : "Manual"}
                      </Badge>
                    </div>
                    {connection.notes && (
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        {connection.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function GraphNodesSection({
  graphModel,
  template,
}: {
  graphModel: ReportGraphModel;
  template: ReportTemplate;
}) {
  const nodesToShow =
    template === "executive"
      ? graphModel.topNodes.slice(0, 4)
      : graphModel.nodes;

  if (nodesToShow.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Network Nodes ({graphModel.nodeCount})
      </h3>
      <div className="grid gap-3">
        {nodesToShow.map((node) => (
          <div
            key={node.key}
            className="rounded-lg border border-border/50 bg-muted/5 px-4 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{node.label}</p>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {node.nodeType}
                  </Badge>
                  {node.consultationTitle && (
                    <Badge variant="secondary" className="text-[10px]">
                      {node.consultationTitle}
                    </Badge>
                  )}
                  {node.memberCount !== null && (
                    <Badge variant="outline" className="text-[10px]">
                      {node.memberCount} member{node.memberCount === 1 ? "" : "s"}
                    </Badge>
                  )}
                  {node.isUserAdded && (
                    <Badge variant="outline" className="text-[10px]">
                      User added
                    </Badge>
                  )}
                </div>
                {node.description && (
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {node.description}
                  </p>
                )}
                {node.groupLabel && template === "executive" && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Grouped under {node.groupLabel}
                  </p>
                )}
              </div>
              <Badge variant="secondary" className="text-[10px]">
                Degree {node.degree}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function LegacyFindingsSection({
  report,
  template,
}: {
  report: ReportArtifactDetail;
  template: ReportTemplate;
}) {
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

  const acceptedToShow =
    template === "executive" ? inputThemes?.slice(0, 3) : inputThemes;
  const showSupporting = template === "standard";

  if (!acceptedToShow?.length && !supportingThemes?.length) return null;

  // Build map: accepted theme label (normalised) → linked supporting themes
  const supportingByAccepted = new Map<
    string,
    Array<{ label: string; description?: string | null; consultation_title?: string | null }>
  >();
  const unlinkedSupporting: Array<{
    label: string;
    description?: string | null;
    consultation_title?: string | null;
  }> = [];

  if (showSupporting && supportingThemes && inputThemes) {
    const acceptedLabelSet = new Set(inputThemes.map((t) => t.label.toLowerCase()));
    for (const st of supportingThemes) {
      const key = st.label.toLowerCase();
      if (acceptedLabelSet.has(key)) {
        const arr = supportingByAccepted.get(key) ?? [];
        arr.push(st);
        supportingByAccepted.set(key, arr);
      } else {
        unlinkedSupporting.push(st);
      }
    }
  }

  return (
    <section className="space-y-6">
      {/* Accepted (round-level) themes with linked consultation evidence */}
      {acceptedToShow && acceptedToShow.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Key Findings ({inputThemes?.length ?? 0})
            {template === "executive" && inputThemes && inputThemes.length > 3 && (
              <span className="ml-2 normal-case tracking-normal font-normal">
                — showing top 3
              </span>
            )}
          </h3>
          <div className="grid gap-3">
            {acceptedToShow.map((theme, i) => {
              const linked = supportingByAccepted.get(theme.label.toLowerCase());
              return (
                <div key={i}>
                  {/* Primary accepted theme */}
                  <div className="group rounded-lg border border-emerald-200/60 border-l-4 border-l-emerald-500 bg-emerald-50/20 px-4 py-3 dark:border-emerald-800/40 dark:border-l-emerald-600 dark:bg-emerald-950/10">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground">{theme.label}</p>
                          <Badge
                            variant="outline"
                            className="shrink-0 border-emerald-300 text-[10px] text-emerald-700 dark:border-emerald-700 dark:text-emerald-400"
                          >
                            Accepted
                          </Badge>
                        </div>
                        {theme.description && (
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            {theme.description}
                          </p>
                        )}
                      </div>
                      <CopyButton
                        text={theme.description ? `${theme.label}: ${theme.description}` : theme.label}
                        label={theme.label}
                      />
                    </div>
                  </div>

                  {/* Linked consultation-level evidence for this theme */}
                  {showSupporting && linked && linked.length > 0 && (
                    <div className="ml-4 mt-1 space-y-1 border-l-2 border-emerald-200/40 pl-3 dark:border-emerald-800/30">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 pb-0.5">
                        Evidence from consultations
                      </p>
                      {linked.map((st, j) => (
                        <div
                          key={j}
                          className="flex items-start gap-2 rounded-md border border-border/30 bg-muted/5 px-3 py-2"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="text-xs font-medium text-foreground/80">{st.label}</p>
                              {st.consultation_title && (
                                <Badge variant="outline" className="text-[10px]">
                                  {st.consultation_title}
                                </Badge>
                              )}
                            </div>
                            {st.description && (
                              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                                {st.description}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Unlinked supporting themes (don't match any accepted label) */}
      {showSupporting && unlinkedSupporting.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Additional Supporting Themes ({unlinkedSupporting.length})
          </h3>
          <div className="grid gap-2">
            {unlinkedSupporting.map((theme, i) => (
              <div
                key={i}
                className="group rounded-lg border border-border/40 border-l-4 border-l-slate-300 bg-slate-50/20 px-4 py-3 dark:border-slate-700/40 dark:border-l-slate-600 dark:bg-slate-900/10"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{theme.label}</p>
                      {theme.consultation_title && (
                        <Badge variant="outline" className="text-[10px]">
                          {theme.consultation_title}
                        </Badge>
                      )}
                    </div>
                    {theme.description && (
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {theme.description}
                      </p>
                    )}
                  </div>
                  <CopyButton
                    text={theme.description ? `${theme.label}: ${theme.description}` : theme.label}
                    label={theme.label}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ─── Draft Groups Section ─────────────────────────────────────────────────────

function DraftGroupsSection({ report }: { report: ReportArtifactDetail }) {
  const draftGroups = report.draftThemeGroups;

  if (!draftGroups || draftGroups.length === 0) return null;

  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Pending Review ({draftGroups.length})
      </h3>
      <div className="grid gap-2">
        {draftGroups.map((group) => (
          <div
            key={group.id}
            className="rounded-lg border border-amber-200/60 border-l-4 border-l-amber-400 bg-amber-50/20 px-4 py-3 dark:border-amber-800/40 dark:border-l-amber-500 dark:bg-amber-950/10"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{group.label}</p>
                  <Badge
                    variant="outline"
                    className="shrink-0 border-amber-300 text-[10px] text-amber-700 dark:border-amber-700 dark:text-amber-400"
                  >
                    Pending Review
                  </Badge>
                </div>
                {group.description && (
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {group.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Evidence Section ────────────────────────────────────────────────────────

function EvidenceSection({ report }: { report: ReportArtifactDetail }) {
  const consultations: ConsultationMeta[] = report.consultations.length > 0
    ? report.consultations
    : report.consultationTitles.map((title) => ({ id: title, title, date: "", people: [] }));

  if (consultations.length === 0) return null;

  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Source Consultations ({consultations.length})
      </h3>
      <div className="grid gap-2">
        {consultations.map((c, i) => (
          <div
            key={c.id}
            className="group flex items-start justify-between rounded-lg border border-border/50 bg-muted/5 px-4 py-3"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted/60 text-xs font-medium text-muted-foreground">
                {i + 1}
              </div>
              <div>
                <p className="text-sm text-foreground">{c.title}</p>
                <div className="mt-0.5 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                  {c.date && (
                    <span>{formatShortDate(c.date)}</span>
                  )}
                  {c.people.length > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="opacity-40">·</span>
                      {c.people.join(", ")}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <CopyButton text={c.title} label={c.title} />
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Audit trail section (compliance) ────────────────────────────────────────

function AuditClusterItem({
  cluster,
  isLast,
}: {
  cluster: AuditCluster;
  isLast: boolean;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex w-4 flex-col items-center">
        <span
          className={cn(
            "mt-1 size-2 shrink-0 rounded-full",
            getAuditDotColor(cluster.action)
          )}
        />
        {!isLast && <span className="mt-1 h-full w-px bg-border/60" />}
      </div>
      <div className="flex-1 pb-3">
        <p className="text-sm text-foreground/85">
          {cluster.count > 1
            ? `${cluster.label} (×${cluster.count})`
            : cluster.label}
        </p>
        <time className="text-xs text-muted-foreground">
          {formatShortDate(cluster.createdAt)}
        </time>
      </div>
    </div>
  );
}

function AuditTrailSection({ report }: { report: ReportArtifactDetail }) {
  const clusters = useMemo(() => {
    const major = filterMajorEvents(report.auditSummary ?? []);
    return clusterAuditEvents(major);
  }, [report.auditSummary]);

  if (clusters.length === 0) return null;

  return (
    // print:break-before-page ensures the audit trail starts on a fresh page in PDF
    <section className="space-y-4 print:break-before-page">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Audit Trail ({clusters.length} milestone{clusters.length === 1 ? "" : "s"})
      </h3>
      <div className="rounded-lg border border-border/50 bg-muted/5 px-4 py-4">
        {clusters.map((cluster, i) => (
          <AuditClusterItem
            key={`${cluster.action}-${cluster.createdAt}`}
            cluster={cluster}
            isLast={i === clusters.length - 1}
          />
        ))}
      </div>
    </section>
  );
}

// ─── Inline bold renderer ─────────────────────────────────────────────────────

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

// ─── Content renderer ────────────────────────────────────────────────────────

function ReportContent({ content }: { content: string }) {
  const blocks = content.split(/\n{2,}/);

  return (
    <div className="space-y-4">
      {blocks.map((block, i) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

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
            <h3
              key={i}
              className="pt-3 text-base font-semibold text-foreground"
            >
              {trimmed.slice(3)}
            </h3>
          );
        }
        if (trimmed.startsWith("# ")) {
          return (
            <h2
              key={i}
              className="pt-4 text-lg font-semibold text-foreground"
            >
              {trimmed.slice(2)}
            </h2>
          );
        }

        const lines = trimmed.split("\n");
        const nonEmptyLines = lines.filter((line) => line.trim() !== "");

        const isBulletList = nonEmptyLines.length > 0 && nonEmptyLines.every(
          (line) =>
            line.trim().startsWith("- ") ||
            line.trim().startsWith("\u2022 ") ||
            line.trim().startsWith("* ")
        );
        const isNumberedList = nonEmptyLines.length > 0 && nonEmptyLines.every(
          (line) => /^\d+\.\s/.test(line.trim())
        );

        if (isBulletList) {
          return (
            <ul
              key={i}
              className="list-inside list-disc space-y-1 pl-1 text-sm leading-relaxed text-foreground/90"
            >
              {lines
                .filter((line) => line.trim())
                .map((line, j) => (
                  <li key={j}>{renderInline(line.replace(/^[\s]*[-\u2022*]\s*/, ""))}</li>
                ))}
            </ul>
          );
        }

        if (isNumberedList) {
          return (
            <ol
              key={i}
              className="list-inside list-decimal space-y-1 pl-1 text-sm leading-relaxed text-foreground/90"
            >
              {lines
                .filter((line) => line.trim())
                .map((line, j) => (
                  <li key={j}>{renderInline(line.replace(/^\d+\.\s*/, ""))}</li>
                ))}
            </ol>
          );
        }

        return (
          <p
            key={i}
            className="text-sm leading-relaxed text-foreground/90"
          >
            {renderInline(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

// ─── Version history sidebar ─────────────────────────────────────────────────

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
    <div className="space-y-2 print:hidden">
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

// ─── Template selector ───────────────────────────────────────────────────────

function TemplateSelector({
  value,
  onChange,
}: {
  value: ReportTemplate;
  onChange: (template: ReportTemplate) => void;
}) {
  return (
    <div className="flex items-center gap-2 print:hidden">
      <span className="text-xs text-muted-foreground">Template:</span>
      <div className="inline-flex rounded-md border border-border/60">
        <button
          type="button"
          onClick={() => onChange("standard")}
          className={`rounded-l-md px-3 py-1 text-xs font-medium transition-colors ${
            value === "standard"
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:bg-muted/40"
          }`}
        >
          Standard
        </button>
        <button
          type="button"
          onClick={() => onChange("executive")}
          className={`rounded-r-md border-l border-border/60 px-3 py-1 text-xs font-medium transition-colors ${
            value === "executive"
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:bg-muted/40"
          }`}
        >
          Executive
        </button>
      </div>
    </div>
  );
}

// ─── Main report view ────────────────────────────────────────────────────────

interface ReportViewProps {
  artifactId: string;
}

export function ReportView({ artifactId }: ReportViewProps) {
  const { data: report, isLoading, error } = useReportArtifact(artifactId);
  const [template, setTemplate] = useState<ReportTemplate>("standard");
  const [isExporting, setIsExporting] = useState(false);

  const handleDownloadPDF = useCallback(async () => {
    if (!report) return;
    setIsExporting(true);
    try {
      const response = await fetch(
        `/api/reports/${report.id}/export?template=${template}`
      );
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `report-${report.id.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF downloaded");
    } catch {
      toast.error("Failed to download PDF. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }, [report, template]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
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

  const readTime = estimateReadTime(report.content);
  const graphModel = buildReportGraphModel(report.inputSnapshot);

  const consultationCount =
    report.consultations.length || report.consultationTitles.length;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Cover page — visible on screen as a styled header, full-page in PDF */}
      <ReportCoverPage
        title={report.title}
        roundLabel={report.roundLabel}
        generatedAt={report.generatedAt}
        matterRef={deriveMatterRef(report.id)}
        consultationCount={consultationCount}
      />

      {/* Navigation */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground print:hidden">
        <Link
          href="/reports"
          className="transition-colors hover:text-foreground"
        >
          Reports
        </Link>
        <span>/</span>
        <span className="text-foreground">{report.title ?? "Untitled"}</span>
      </div>

      {/* ─── Report header ─── */}
      <header className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
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
          <div className="flex items-center gap-2 print:hidden">
            <TemplateSelector value={template} onChange={setTemplate} />
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownloadPDF}
              disabled={isExporting}
            >
              {isExporting ? "Exporting..." : "Download PDF"}
            </Button>
          </div>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">
            ~{readTime} min read
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {report.title ?? "Untitled Report"}
          </h1>
        </div>

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

      {/* ─── Quick Stats ─── */}
      <QuickStats report={report} />

      <Separator />

      {/* ─── Report body + sidebar layout ─── */}
      <div className="grid gap-8 lg:grid-cols-[1fr_260px]">
        {/* Main content */}
        <article className="min-w-0 space-y-8">
          <ReportContent content={report.content} />

          <Separator />

          {graphModel ? (
            <>
              <GraphOverviewSection graphModel={graphModel} />
              <Separator />
              <GraphConnectionsSection
                graphModel={graphModel}
                template={template}
              />
              <Separator />
              <GraphNodesSection
                graphModel={graphModel}
                template={template}
              />
            </>
          ) : (
            <>
              <LegacyFindingsSection report={report} template={template} />
            </>
          )}

          {report.draftThemeGroups && report.draftThemeGroups.length > 0 && (
            <>
              <Separator />
              <DraftGroupsSection report={report} />
            </>
          )}

          {template === "standard" && (
            <>
              <Separator />
              <EvidenceSection report={report} />
              <Separator />
              <AuditTrailSection report={report} />
            </>
          )}
        </article>

        {/* Sidebar */}
        <aside className="space-y-6 print:hidden">
          <VersionHistory report={report} currentId={artifactId} />

          {/* Metadata callout */}
          <div className="rounded-lg border border-border/50 bg-muted/5 p-4 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Report Info
            </h3>
            <div className="space-y-1.5 text-xs text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">Round:</span>{" "}
                <Link
                  href={`/consultations/${report.roundId}`}
                  className="underline transition-colors hover:text-foreground"
                >
                  {report.roundLabel}
                </Link>
              </p>
              <p>
                <span className="font-medium text-foreground">Generated:</span>{" "}
                {formatDate(report.generatedAt)}
              </p>
              {report.totalVersions > 1 && (
                <p>
                  <span className="font-medium text-foreground">Version:</span>{" "}
                  {report.versionNumber} of {report.totalVersions}
                </p>
              )}
              <p className="pt-1">
                <code className="text-[10px] text-muted-foreground/60">
                  {report.id}
                </code>
              </p>
            </div>
          </div>
        </aside>
      </div>

      {/* ─── Footer ─── */}
      <Separator className="print:hidden" />

      <footer className="space-y-2 pb-8 text-xs text-muted-foreground print:hidden">
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
