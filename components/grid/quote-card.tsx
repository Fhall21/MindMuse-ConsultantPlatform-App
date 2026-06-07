"use client";

import { Badge } from "@/components/ui/badge";
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

export interface QuoteCardProps {
  quote: QuoteLink;
  meetingId: string;
}

export function QuoteCard({ quote }: QuoteCardProps) {
  const config = quote.relevanceStrength
    ? RELEVANCE_CONFIG[quote.relevanceStrength]
    : null;

  return (
    <article
      className={cn(
        "space-y-2 rounded-lg border px-3 py-3 transition-colors",
        quote.relevanceStrength === "strong_match" &&
          "border-emerald-500/30 bg-emerald-500/5",
        (!quote.relevanceStrength || quote.relevanceStrength === "weak") &&
          "border-border/70"
      )}
    >
      {config && (
        <Badge
          variant="outline"
          className={cn("text-[10px]", config.className)}
        >
          {config.label}
        </Badge>
      )}

      <blockquote className="border-l-4 border-primary/40 pl-3 text-sm italic leading-relaxed text-foreground">
        {quote.exactText}
      </blockquote>

      {quote.speakerLabel && (
        <p className="text-[11px] text-muted-foreground">— {quote.speakerLabel}</p>
      )}
    </article>
  );
}
