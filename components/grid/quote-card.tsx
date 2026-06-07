"use client";

import { useState } from "react";
import { ChevronsUpDown, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { QuoteLink, RelevanceStrength } from "@/types/grid";

const RELEVANCE_LABELS: Record<RelevanceStrength, string> = {
  strong_match: "Strong match",
  partial_support: "Partial support",
  context: "Context",
  weak: "Weak",
};

export interface QuoteCardProps {
  quote: QuoteLink;
  meetingId: string;
  onUnlink?: (quoteId: string) => void;
  unlinkDisabled?: boolean;
}

export function QuoteCard({
  quote,
  onUnlink,
  unlinkDisabled = false,
}: QuoteCardProps) {
  const [expanded, setExpanded] = useState(false);
  const hasExpandedContext = Boolean(
    quote.expandedContextBefore || quote.expandedContextAfter
  );
  const contextBefore = expanded
    ? (quote.expandedContextBefore ?? quote.contextBefore)
    : quote.contextBefore;
  const contextAfter = expanded
    ? (quote.expandedContextAfter ?? quote.contextAfter)
    : quote.contextAfter;
  const hasContext = Boolean(contextBefore || contextAfter);
  const relevanceLabel = quote.relevanceStrength
    ? RELEVANCE_LABELS[quote.relevanceStrength]
    : null;

  return (
    <article className="group/quote rounded-md border border-border bg-card p-3 transition-colors">
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <div className="text-[0.6125rem] font-semibold uppercase tracking-widest text-muted-foreground">
          {quote.speakerLabel || "Unknown"}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {hasExpandedContext ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground"
              aria-label={expanded ? "Collapse quote context" : "Expand quote context"}
              aria-pressed={expanded}
              onClick={() => setExpanded((value) => !value)}
            >
              <ChevronsUpDown className="size-3.5" aria-hidden="true" />
            </Button>
          ) : null}
          {onUnlink ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover/quote:opacity-100 focus-visible:opacity-100"
                  aria-label="Unlink quote from insight"
                  disabled={unlinkDisabled}
                  onClick={() => onUnlink(quote.id)}
                >
                  <Unlink className="size-3.5" aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Remove this quote from this insight. Quote stays in meeting review.
              </TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      </div>

      {relevanceLabel ? (
        <p className="mb-2 text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
          {relevanceLabel}
        </p>
      ) : null}

      <p
        className={cn(
          "text-sm italic leading-relaxed",
          hasContext ? "text-muted-foreground" : "text-foreground"
        )}
      >
        {contextBefore}
        <span className="rounded-sm bg-green-200/40 px-0.5 text-foreground not-italic dark:bg-green-900/30">
          {quote.exactText}
        </span>
        {contextAfter}
      </p>
    </article>
  );
}
