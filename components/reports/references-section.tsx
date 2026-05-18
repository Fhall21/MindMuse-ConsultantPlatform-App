"use client";

import { BookOpen, ExternalLink } from "lucide-react";
import { HoverCard as HoverCardPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";
import type { ReportReference } from "@/hooks/use-report-references";

interface ReferenceCitationChipProps {
  number: number;
  reference: ReportReference | undefined;
  onJump?: (number: number) => void;
}

export function ReferenceCitationChip({
  number,
  reference,
  onJump,
}: ReferenceCitationChipProps) {
  if (!reference) {
    return (
      <span className="mx-0.5 inline-flex h-[1.35em] items-center rounded bg-muted px-[0.4em] align-baseline text-[0.75em] font-semibold leading-none text-muted-foreground">
        [{number}]
      </span>
    );
  }

  return (
    <HoverCardPrimitive.Root openDelay={250} closeDelay={120}>
      <HoverCardPrimitive.Trigger asChild>
        <button
          type="button"
          onClick={() => onJump?.(number)}
          className={cn(
            "mx-0.5 inline-flex h-[1.35em] items-center rounded px-[0.4em]",
            "align-baseline text-[0.75em] font-semibold leading-none tabular-nums",
            "bg-stone-100 text-stone-700 ring-1 ring-stone-300/60 hover:bg-stone-200",
            "dark:bg-stone-900/60 dark:text-stone-200 dark:ring-stone-700/60"
          )}
          aria-label={`Reference ${number}: ${reference.shortCite}`}
        >
          [{number}]
        </button>
      </HoverCardPrimitive.Trigger>
      <HoverCardPrimitive.Portal>
        <HoverCardPrimitive.Content
          align="start"
          side="top"
          sideOffset={6}
          avoidCollisions
          className={cn(
            "z-50 w-96 rounded-md border bg-popover p-3.5 shadow-lg",
            "ring-1 ring-foreground/8 text-sm text-popover-foreground"
          )}
        >
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-flex h-5 items-center rounded bg-stone-100 px-1.5 text-[10px] font-bold uppercase tracking-wide text-stone-700 dark:bg-stone-900 dark:text-stone-300">
              Ref [{number}]
            </span>
            <BookOpen className="h-3.5 w-3.5 text-stone-500" aria-hidden />
          </div>
          <p className="text-sm font-semibold text-foreground">{reference.shortCite}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {reference.fullCite}
          </p>
          {reference.quotes.length > 0 ? (
            <div className="mt-3 space-y-2">
              {reference.quotes.map((q) => (
                <blockquote
                  key={q.id}
                  className="border-l-2 border-stone-300 pl-2 text-xs italic leading-relaxed text-foreground/80 dark:border-stone-600"
                >
                  &ldquo;{q.quote}&rdquo;
                </blockquote>
              ))}
            </div>
          ) : null}
          {reference.sourceUrl ? (
            <a
              href={reference.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-xs text-foreground/70 underline-offset-2 hover:underline"
            >
              Open source
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </HoverCardPrimitive.Content>
      </HoverCardPrimitive.Portal>
    </HoverCardPrimitive.Root>
  );
}

export function ReferencesSection({
  references,
}: {
  references: ReportReference[];
}) {
  if (references.length === 0) return null;
  return (
    <section className="space-y-3" id="report-references">
      <h2 className="text-lg font-semibold text-foreground">References</h2>
      <p className="text-xs text-muted-foreground">
        Research sources cited in this report. Quotes shown are the exact passages
        extracted from each source.
      </p>
      <ol className="space-y-3">
        {references.map((ref) => (
          <li
            key={ref.researchSessionId}
            id={`report-reference-${ref.number}`}
            className="rounded-md border bg-card p-3"
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-6 w-8 shrink-0 items-center justify-center rounded bg-stone-100 text-xs font-semibold text-stone-700 dark:bg-stone-900 dark:text-stone-300">
                [{ref.number}]
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{ref.shortCite}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {ref.fullCite}
                </p>
                {ref.quotes.length > 0 ? (
                  <ul className="mt-2 space-y-1.5">
                    {ref.quotes.map((q) => (
                      <li
                        key={q.id}
                        className="border-l-2 border-stone-300 pl-2 text-xs italic leading-relaxed text-foreground/80 dark:border-stone-600"
                      >
                        &ldquo;{q.quote}&rdquo;
                      </li>
                    ))}
                  </ul>
                ) : null}
                {ref.sourceUrl ? (
                  <a
                    href={ref.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs text-foreground/70 underline-offset-2 hover:underline"
                  >
                    Open source
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
