"use client";

import { HoverCard as HoverCardPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";
import type { LiteratureReference } from "@/hooks/use-research";

interface CitationChipProps {
  num: string;
  reference: LiteratureReference | undefined;
  onCitationClick?: (num: string) => void;
}

export function CitationChip({ num, reference, onCitationClick }: CitationChipProps) {
  const trigger = (
    <button
      type="button"
      onClick={() => onCitationClick?.(num)}
      className={cn(
        "inline-flex items-center justify-center align-super",
        "h-[1.15em] min-w-[1.15em] px-[0.3em]",
        "rounded text-[0.7em] font-semibold leading-none tabular-nums",
        "ring-1 ring-inset ring-border",
        "text-muted-foreground bg-transparent",
        "transition-colors duration-100",
        "hover:bg-primary/8 hover:text-primary hover:ring-primary/40",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        "cursor-pointer select-none",
        // indicate interactivity when reference data is available
        reference ? "underline decoration-dotted underline-offset-2 decoration-muted-foreground/40" : "",
      )}
      aria-label={
        reference
          ? `Citation ${num}: ${reference.title}`
          : `Citation ${num}`
      }
    >
      {num}
    </button>
  );

  if (!reference) {
    return <span className="mx-0.5">{trigger}</span>;
  }

  const meta = [reference.authors, reference.year && `(${reference.year})`, reference.journal]
    .filter(Boolean)
    .join(" · ");

  return (
    <HoverCardPrimitive.Root openDelay={280} closeDelay={100}>
      <HoverCardPrimitive.Trigger asChild>
        <span className="mx-0.5 inline-flex">{trigger}</span>
      </HoverCardPrimitive.Trigger>
      <HoverCardPrimitive.Portal>
        <HoverCardPrimitive.Content
          align="start"
          side="top"
          sideOffset={6}
          avoidCollisions
          className={cn(
            "z-50 w-72 origin-(--radix-hover-card-content-transform-origin)",
            "rounded-md border bg-popover p-3 shadow-md",
            "ring-1 ring-foreground/8",
            "text-sm text-popover-foreground",
            "duration-100",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
            "data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2",
          )}
        >
          {/* Reference number label */}
          <span className="mb-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground/70">
            {reference.number}
          </span>

          {/* Title */}
          <p className="mt-1 font-medium leading-snug text-foreground">
            {reference.url ? (
              <a
                href={reference.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline-offset-2 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {reference.title}
              </a>
            ) : (
              reference.title
            )}
          </p>

          {/* Authors · year · journal */}
          {meta && (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{meta}</p>
          )}

          {/* Hint to click for full reference */}
          <p className="mt-2 text-[11px] text-muted-foreground/50">
            Click to view in references
          </p>
        </HoverCardPrimitive.Content>
      </HoverCardPrimitive.Portal>
    </HoverCardPrimitive.Root>
  );
}
