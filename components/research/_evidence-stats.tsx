"use client";

import { cn } from "@/lib/utils";
import type { LiteratureStats } from "@/hooks/use-research";

interface EvidenceStatsProps {
  stats?: LiteratureStats;
  fallbackRelevantPapers: number;
  fallbackCurrentEvidence: number;
}

function Tier1Tile({ label, value }: { label: string; value: number }) {
  const isZero = value === 0;
  return (
    <div className="flex flex-1 flex-col gap-1 px-4 py-3">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80">
        {label}
      </span>
      <span
        className={cn(
          "text-2xl font-semibold tabular-nums leading-none",
          isZero ? "text-muted-foreground/40" : "text-foreground"
        )}
      >
        {value}
      </span>
    </div>
  );
}

function Tier2Metric({ label, value }: { label: string; value: string | number }) {
  const isZero = value === 0 || value === "0" || value === "0 / 0";
  return (
    <span
      className={cn(
        "tabular-nums",
        isZero ? "text-muted-foreground/40" : "text-muted-foreground"
      )}
    >
      <span className="text-muted-foreground/70">{label}</span>{" "}
      <span className="font-medium">{value}</span>
    </span>
  );
}

export function EvidenceStats({
  stats,
  fallbackRelevantPapers,
  fallbackCurrentEvidence,
}: EvidenceStatsProps) {
  // Fallback when Edison didn't surface analysis_status: render Tier 1 only,
  // derived from data we already have.
  if (!stats) {
    return (
      <div className="grid grid-cols-1 divide-y rounded-lg border bg-card sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <Tier1Tile label="Relevant papers" value={fallbackRelevantPapers} />
        <Tier1Tile label="Current evidence" value={fallbackCurrentEvidence} />
      </div>
    );
  }

  const trialsLabel = `${stats.relevant_clinical_trials} / ${stats.clinical_trial_count}`;

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-1 divide-y rounded-lg border bg-card sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Tier1Tile label="Papers screened" value={stats.paper_count} />
        <Tier1Tile label="Relevant papers" value={stats.relevant_papers} />
        <Tier1Tile label="Current evidence" value={stats.current_evidence} />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs">
        <Tier2Metric label="Clinical trials" value={trialsLabel} />
        <span className="text-muted-foreground/30">·</span>
        <Tier2Metric label="Disease-target" value={stats.disease_target_evidence} />
      </div>
    </div>
  );
}
