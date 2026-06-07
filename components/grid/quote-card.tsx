"use client";

import { cn } from "@/lib/utils";
import type { QuoteLink, RelevanceStrength } from "@/types/grid";

const RELEVANCE_CONFIG: Record<
  RelevanceStrength,
  { label: string; className: string }
> = {
  strong_match: {
    label: "Strong match",
    className:
      "border-emerald-200 bg-emerald-100/80 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-200",
  },
  partial_support: {
    label: "Partial support",
    className:
      "border-blue-200 bg-blue-100/80 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/50 dark:text-blue-200",
  },
  context: {
    label: "Context",
    className:
      "border-amber-200 bg-amber-100/80 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-200",
  },
  weak: {
    label: "Weak",
    className: "border-border bg-muted/60 text-muted-foreground",
  },
};

type QuoteWithContext = QuoteLink & {
  contextBefore?: string | null;
  contextAfter?: string | null;
};

export interface QuoteCardProps {
  quote: QuoteLink;
  meetingId: string;
}

export function QuoteCard({ quote }: QuoteCardProps) {
  const quoteWithContext = quote as QuoteWithContext;
  const config = quote.relevanceStrength
    ? RELEVANCE_CONFIG[quote.relevanceStrength]
    : null;
  const contextBefore = quoteWithContext.contextBefore ?? null;
  const contextAfter = quoteWithContext.contextAfter ?? null;
  const hasContext = Boolean(contextBefore || contextAfter);

  return (
    <article className="rounded-md border border-border bg-card p-3 transition-colors">
      <div className="mb-1.5 text-[0.6125rem] font-semibold uppercase tracking-widest text-muted-foreground">
        {quote.speakerLabel || "Unknown"}
      </div>

      {config && (
        <span
          className={cn(
            "mb-2 inline-block rounded-md border px-2 py-0.5 text-[0.65rem] font-medium",
            config.className
          )}
        >
          {config.label}
        </span>
      )}

      <p
        className={cn(
          "text-sm italic leading-relaxed",
          hasContext ? "text-muted-foreground" : "text-foreground"
        )}
      >
        {contextBefore}
        <span className="rounded-sm bg-green-200/40 px-0.5 text-foreground not-italic">
          {quote.exactText}
        </span>
        {contextAfter}
      </p>
    </article>
  );
}
