"use client";

import { formatDate } from "@/lib/report-formatting";

interface ReportCoverPageProps {
  title: string | null;
  roundLabel: string;
  generatedAt: string;
  /** Short human-readable reference derived from the artifact ID */
  matterRef: string;
  consultationCount: number;
}

/**
 * Full-page cover rendered at the top of every report.
 *
 * On screen: a visually distinct header block above the report body.
 * In print/PDF: takes a full page, followed by a page break.
 *
 * Layout:
 *   ┌─────────────────────────────────────────┐
 *   │  [header band]                          │
 *   │  Title                                  │
 *   │  Consultation · Ref                     │
 *   │  Generated date · N meetings            │
 *   │  CONFIDENTIAL notice                    │
 *   └─────────────────────────────────────────┘
 */
export function ReportCoverPage({
  title,
  roundLabel,
  generatedAt,
  matterRef,
  consultationCount,
}: ReportCoverPageProps) {
  return (
    // Screen: styled block. Print: full page, then page break before content.
    <div className="print:break-after-page print:min-h-screen print:flex print:flex-col print:justify-between">
      {/* Top accent band */}
      <div className="h-1.5 w-full bg-gradient-to-r from-violet-500 via-emerald-500 to-sky-500 print:h-2" />

      {/* Main cover content */}
      <div className="flex flex-1 flex-col justify-center px-10 py-16 print:px-16 print:py-24">
        {/* Document type label */}
        <p className="mb-6 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Psychosocial Consultation Report
        </p>

        {/* Title */}
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl print:text-5xl">
          {title ?? "Consultation Report"}
        </h1>

        {/* Round label */}
        <p className="mt-3 text-lg text-muted-foreground">{roundLabel}</p>

        {/* Meta row */}
        <div className="mt-8 flex flex-wrap gap-6 border-t border-border/40 pt-6 text-sm text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">Generated</span>{" "}
            {formatDate(generatedAt)}
          </span>
          <span>
            <span className="font-medium text-foreground">Meetings</span>{" "}
            {consultationCount}
          </span>
          <span>
            <span className="font-medium text-foreground">Ref</span>{" "}
            <code className="font-mono text-xs">{matterRef}</code>
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border/30 px-10 py-6 print:px-16">
        <p className="text-[11px] text-muted-foreground/60">
          CONFIDENTIAL — This document contains psychosocial consultation evidence.
          It is intended solely for the recipient(s) named above and must not be
          distributed without authorisation.
        </p>
      </div>
    </div>
  );
}

/**
 * Derive a short human-readable matter reference from an artifact UUID.
 * e.g. "a3f7b2d1-..." → "CP-A3F7"
 */
export function deriveMatterRef(artifactId: string): string {
  return `CP-${artifactId.slice(0, 4).toUpperCase()}`;
}
