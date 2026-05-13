"use client";

import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { ReferenceStrengthBadge } from "@/components/research/_reference-strength-badge";
import type { LiteratureReference } from "@/hooks/use-research";

interface ReferencesListProps {
  references: LiteratureReference[];
  onJumpToEvidence?: (refNumber: number, chunkId: string) => void;
}

export function ReferencesList({ references, onJumpToEvidence }: ReferencesListProps) {
  if (references.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No references were cited in this answer.
      </p>
    );
  }

  return (
    <ol className="divide-y">
      {references.map((ref) => (
        <ReferenceRow key={ref.number} reference={ref} onJumpToEvidence={onJumpToEvidence} />
      ))}
    </ol>
  );
}

function ReferenceRow({
  reference: ref,
  onJumpToEvidence,
}: {
  reference: LiteratureReference;
  onJumpToEvidence?: (refNumber: number, chunkId: string) => void;
}) {
  const monthYear = [ref.journal, ref.year].filter(Boolean).join(" · ");
  const hasContexts = (ref.contexts_used?.length ?? 0) + (ref.contexts_unused?.length ?? 0) > 0;

  return (
    <li
      id={`ref-${ref.number}`}
      className="flex gap-3 py-3.5 text-sm scroll-mt-4 transition-colors data-[highlighted]:bg-accent/30 rounded-sm"
    >
      <span
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-muted-foreground"
        aria-label={`Reference ${ref.number}`}
      >
        {ref.number}
      </span>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-baseline gap-1.5">
          {ref.url ? (
            <a
              href={ref.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium leading-snug text-foreground underline-offset-2 hover:underline"
            >
              {ref.title}
            </a>
          ) : (
            <p className="font-medium leading-snug text-foreground">{ref.title}</p>
          )}
          {ref.url && (
            <ExternalLink className="h-3 w-3 shrink-0 -translate-y-px text-muted-foreground/60" aria-hidden />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {ref.authors && <span className="truncate">{ref.authors}</span>}
          {ref.authors && monthYear && <Sep />}
          {monthYear && <span>{monthYear}</span>}
          {ref.strength && (
            <>
              <Sep />
              <ReferenceStrengthBadge strength={ref.strength} />
            </>
          )}
          {typeof ref.citation_count === "number" && (
            <>
              <Sep />
              <span className="tabular-nums">
                <span className="text-muted-foreground/70">citations</span>{" "}
                <span className="font-medium text-foreground/80">{ref.citation_count}</span>
              </span>
            </>
          )}
        </div>

        {hasContexts && (
          <ContextsLine
            refNumber={ref.number}
            used={ref.contexts_used ?? []}
            unused={ref.contexts_unused ?? []}
            onJumpToEvidence={onJumpToEvidence}
          />
        )}
      </div>
    </li>
  );
}

function Sep() {
  return <span className="text-muted-foreground/30" aria-hidden>◇</span>;
}

function ContextsLine({
  refNumber,
  used,
  unused,
  onJumpToEvidence,
}: {
  refNumber: number;
  used: string[];
  unused: string[];
  onJumpToEvidence?: (refNumber: number, chunkId: string) => void;
}) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs text-muted-foreground/80">
      <span className="text-muted-foreground/60">Contexts:</span>
      {used.length > 0 && (
        <>
          <span className="text-muted-foreground/70">Used</span>
          {used.map((id) => (
            <ChunkLink
              key={id}
              id={id}
              isUsed
              onClick={onJumpToEvidence ? () => onJumpToEvidence(refNumber, id) : undefined}
            />
          ))}
        </>
      )}
      {unused.length > 0 && (
        <>
          {used.length > 0 && <span className="text-muted-foreground/40">·</span>}
          <span className="text-muted-foreground/70">Unused</span>
          {unused.map((id) => (
            <ChunkLink key={id} id={id} isUsed={false} />
          ))}
        </>
      )}
    </p>
  );
}

function ChunkLink({
  id,
  isUsed,
  onClick,
}: {
  id: string;
  isUsed: boolean;
  onClick?: () => void;
}) {
  if (isUsed && onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={`Jump to evidence ${id}`}
        className={cn(
          "rounded-sm px-0.5 tabular-nums text-foreground/80",
          "underline-offset-2 transition-colors hover:text-foreground hover:underline"
        )}
      >
        {id}
      </button>
    );
  }
  return (
    <span
      className={cn(
        "tabular-nums",
        isUsed ? "text-foreground/80" : "text-muted-foreground/40"
      )}
    >
      {id}
    </span>
  );
}
