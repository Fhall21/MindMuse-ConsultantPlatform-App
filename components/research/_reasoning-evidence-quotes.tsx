"use client";

import type { GatherExcerpt, GatherRound, GatherStepData } from "@/hooks/use-research";

interface EvidenceQuotesProps {
  data: GatherStepData;
}

function ExcerptCard({ q, idx }: { q: GatherExcerpt; idx: number }) {
  return (
    <li className="space-y-1 border-l border-border/60 pl-3">
      <div className="flex items-baseline gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/60">
        <span className="tabular-nums">#{idx + 1}</span>
        {q.source_citation_key && (
          <>
            <span className="text-muted-foreground/30">·</span>
            <span className="normal-case font-mono text-[10px] tracking-normal text-muted-foreground/80">
              {q.source_citation_key}
            </span>
          </>
        )}
        {typeof q.citation_count === "number" && (
          <>
            <span className="text-muted-foreground/30">·</span>
            <span className="tabular-nums">citations {q.citation_count}</span>
          </>
        )}
      </div>
      <p className="text-xs leading-relaxed text-foreground/85">{q.excerpt}</p>
    </li>
  );
}

function Round({ round, ordinal }: { round: GatherRound; ordinal: number }) {
  return (
    <div className="space-y-2">
      <div className="space-y-0.5">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
          Sub-question {ordinal}
        </p>
        <p className="text-sm leading-snug text-foreground/90">{round.question}</p>
        <p className="text-[10px] text-muted-foreground/60">
          {round.excerpts_count} excerpts
          {round.focus_papers && round.focus_papers.length > 0 && (
            <span> · focused on {round.focus_papers.length} papers</span>
          )}
        </p>
      </div>
      {round.top_excerpts.length > 0 && (
        <ul className="space-y-2">
          {round.top_excerpts.map((q, i) => (
            <ExcerptCard key={q.id ?? i} q={q} idx={i} />
          ))}
        </ul>
      )}
    </div>
  );
}

export function ReasoningEvidenceQuotes({ data }: EvidenceQuotesProps) {
  const rounds = data.rounds && data.rounds.length > 0 ? data.rounds : [
    { question: data.question, excerpts_count: data.excerpts_count, top_excerpts: data.top_excerpts },
  ];

  return (
    <div className="space-y-5">
      {rounds.map((r, i) => (
        <Round key={i} round={r} ordinal={i + 1} />
      ))}
    </div>
  );
}
