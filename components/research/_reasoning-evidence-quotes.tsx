"use client";

import type { GatherStepData } from "@/hooks/use-research";

interface EvidenceQuotesProps {
  data: GatherStepData;
}

export function ReasoningEvidenceQuotes({ data }: EvidenceQuotesProps) {
  return (
    <div className="space-y-3">
      {data.question && (
        <div className="space-y-1">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
            Question asked
          </p>
          <p className="text-sm leading-snug text-foreground/90">{data.question}</p>
        </div>
      )}

      {data.top_excerpts.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
            Top excerpts{" "}
            {data.excerpts_count > data.top_excerpts.length && (
              <span className="font-normal text-muted-foreground/50">
                (of {data.excerpts_count})
              </span>
            )}
          </p>
          <ul className="space-y-2">
            {data.top_excerpts.map((q, i) => (
              <li
                key={i}
                className="border-l border-border/60 pl-3 text-xs leading-relaxed text-foreground/85"
              >
                <span>“{q.excerpt}”</span>
                {q.source_ref_number != null && (
                  <span className="ml-1 text-muted-foreground/60">[{q.source_ref_number}]</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
