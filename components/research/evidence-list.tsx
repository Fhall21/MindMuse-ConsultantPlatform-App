"use client";

import { ArrowUpRight, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { EvidenceStats } from "@/components/research/_evidence-stats";
import type {
  EvidenceExcerpt,
  LiteratureReference,
  LiteratureStats,
} from "@/hooks/use-research";

interface EvidenceListProps {
  evidence: EvidenceExcerpt[];
  references?: LiteratureReference[];
  stats?: LiteratureStats;
  onJumpToReference?: (refNumber: number) => void;
}

export function EvidenceList({
  evidence,
  references,
  stats,
  onJumpToReference,
}: EvidenceListProps) {
  const refsByNumber = new Map<number, LiteratureReference>();
  for (const r of references ?? []) refsByNumber.set(r.number, r);

  const fallbackRelevant = references?.length ?? 0;
  const fallbackCurrent = evidence.length;

  return (
    <div className="space-y-6">
      <EvidenceStats
        stats={stats}
        fallbackRelevantPapers={fallbackRelevant}
        fallbackCurrentEvidence={fallbackCurrent}
      />

      {evidence.length === 0 ? (
        <p className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
          No evidence excerpts were extracted — try refining the question.
        </p>
      ) : (
        <ul className="divide-y">
          {evidence.map((item) => (
            <EvidenceItem
              key={item.id}
              item={item}
              reference={
                item.source_ref_number != null
                  ? refsByNumber.get(item.source_ref_number)
                  : undefined
              }
              onJumpToReference={onJumpToReference}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function EvidenceItem({
  item,
  reference,
  onJumpToReference,
}: {
  item: EvidenceExcerpt;
  reference?: LiteratureReference;
  onJumpToReference?: (refNumber: number) => void;
}) {
  const refNum = item.source_ref_number ?? reference?.number;
  const title = item.source_title ?? reference?.title;
  const url = item.source_url ?? reference?.url;
  const authors = reference?.authors;
  const hasSource = refNum != null;

  return (
    <li className="space-y-2 py-4">
      {hasSource && (
        <div className="flex items-baseline gap-2.5">
          <span
            className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-muted-foreground"
            aria-label={`Reference ${refNum}`}
          >
            {refNum}
          </span>
          <div className="min-w-0 flex-1 space-y-0.5">
            {title ? (
              url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-baseline gap-1 text-sm font-medium leading-snug text-foreground hover:underline"
                >
                  <span className="truncate">{title}</span>
                  <ArrowUpRight className="h-3 w-3 shrink-0 -translate-y-px text-muted-foreground/60 transition-colors group-hover:text-foreground" />
                </a>
              ) : (
                <p className="truncate text-sm font-medium leading-snug text-foreground">
                  {title}
                </p>
              )
            ) : null}
            {authors && (
              <p className="truncate text-xs text-muted-foreground">{authors}</p>
            )}
          </div>
        </div>
      )}

      {item.question && (
        <p className="text-xs italic leading-snug text-muted-foreground">
          Question asked: {item.question}
        </p>
      )}

      <p
        className={cn(
          "border-l border-border/60 pl-3 text-sm leading-relaxed text-foreground/90",
          hasSource ? "ml-7" : ""
        )}
      >
        {item.excerpt}
      </p>

      <div
        className={cn(
          "flex items-center justify-between gap-3 text-xs text-muted-foreground",
          hasSource ? "ml-7" : ""
        )}
      >
        <span className="tabular-nums">
          Relevance{" "}
          <span className="font-medium text-foreground/80">
            {(() => {
              const raw = item.score;
              if (!Number.isFinite(raw)) return "—";

              const normalizedToTen = raw <= 1 ? raw * 10 : raw;
              const clamped = Math.min(10, Math.max(0, normalizedToTen));

              return `${clamped.toFixed(1)}/10`;
            })()}
          </span>
        </span>
        {hasSource && onJumpToReference && (
          <button
            type="button"
            onClick={() => onJumpToReference(refNum)}
            className="inline-flex items-center gap-0.5 text-muted-foreground transition-colors hover:text-foreground"
            aria-label={`Jump to reference ${refNum}`}
          >
            Jump to reference
            <ChevronRight className="h-3 w-3" />
          </button>
        )}
      </div>
    </li>
  );
}
