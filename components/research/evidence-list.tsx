"use client";

import type { EvidenceExcerpt } from "@/hooks/use-research";

interface EvidenceListProps {
  evidence: EvidenceExcerpt[];
}

export function EvidenceList({ evidence }: EvidenceListProps) {
  if (evidence.length === 0) {
    return <p className="text-sm text-muted-foreground">No evidence excerpts available.</p>;
  }

  return (
    <div className="divide-y">
      {evidence.map((item) => (
        <div key={item.id} className="py-3 space-y-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-xs text-muted-foreground leading-snug">{item.question}</p>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground/60">
              {(item.score * 100).toFixed(0)}%
            </span>
          </div>
          <p className="text-sm leading-relaxed">{item.excerpt}</p>
        </div>
      ))}
    </div>
  );
}
