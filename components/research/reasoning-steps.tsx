"use client";

import { useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { ReasoningStep } from "@/hooks/use-research";

// ── Content renderers (exported for InFlightSteps on detail page) ─────────────

export function StepContent({ label, content }: { label: string; content: string }) {
  // Planning research: ✓ / → / ○ objective checklist — flat, no icon badges
  if (label === "Planning research") {
    const lines = content.split("\n").filter(Boolean);
    return (
      <ul className="space-y-2">
        {lines.map((line, i) => {
          const icon = line[0];
          const text = line.slice(2).trim();
          const done = icon === "✓";
          const active = icon === "→";
          return (
            <li key={i} className="flex items-start gap-2.5 text-sm">
              <span
                className={cn(
                  "mt-0.5 w-3.5 shrink-0 text-center text-xs leading-none",
                  done && "text-muted-foreground/40",
                  active && "text-primary",
                  !done && !active && "text-muted-foreground/25"
                )}
              >
                {done ? "✓" : active ? "→" : "·"}
              </span>
              <span
                className={cn(
                  "leading-snug",
                  done && "text-muted-foreground/50 line-through",
                  active && "font-medium text-foreground",
                  !done && !active && "text-muted-foreground/40"
                )}
              >
                {text}
              </span>
            </li>
          );
        })}
      </ul>
    );
  }

  // Searching literature: stacked rows — query above, papers below
  if (label === "Searching literature") {
    const lines = content.split("\n").filter(Boolean);
    return (
      <ul className="divide-y divide-border/30">
        {lines.map((line, i) => {
          const sepIdx = line.indexOf(" → ");
          const query = sepIdx >= 0 ? line.slice(0, sepIdx) : line;
          const papers = sepIdx >= 0 ? line.slice(sepIdx + 3) : undefined;
          return (
            <li key={i} className="py-2.5 first:pt-0 last:pb-0">
              <p className="text-sm text-foreground/80">{query}</p>
              {papers && (
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {papers}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  // Synthesising findings: markdown table — no card wrapper, just dividers
  if (label === "Synthesising findings" && content.includes("|")) {
    const rows = content
      .split("\n")
      .map((r) => r.trim())
      .filter((r) => r.startsWith("|") && !r.match(/^\|[-| ]+\|$/));
    if (rows.length >= 2) {
      const parseRow = (row: string) =>
        row.split("|").slice(1, -1).map((c) => c.trim());
      const [headerRow, ...bodyRows] = rows;
      const headers = parseRow(headerRow);
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/50">
                {headers.map((h, hi) => (
                  <th key={hi} className="pb-2 pr-4 text-left font-medium text-foreground/70">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {bodyRows.map((row, ri) => (
                <tr key={ri}>
                  {parseRow(row).map((cell, ci) => (
                    <td key={ci} className="py-2 pr-4 text-muted-foreground">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
  }

  // Default: plain pre-wrap text
  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
      {content}
    </p>
  );
}

// ── Main accordion component ───────────────────────────────────────────────────

interface ReasoningStepsProps {
  steps: ReasoningStep[];
  isLoading?: boolean;
}

export function ReasoningSteps({ steps, isLoading = false }: ReasoningStepsProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(
    steps.length > 0 ? (isLoading ? steps.length - 1 : 0) : null
  );

  if (steps.length === 0) {
    if (!isLoading) return null;
    return <p className="text-sm text-muted-foreground">Waiting for first steps…</p>;
  }

  return (
    <div className="divide-y divide-border/50 overflow-hidden rounded-lg border">
      {steps.map((step, i) => {
        const isActive = isLoading && i === steps.length - 1;
        const hasContent = Boolean(step.content);
        const isOpen = openIndex === i && hasContent;

        return (
          <Collapsible
            key={i}
            open={isOpen}
            onOpenChange={(open) => setOpenIndex(open ? i : null)}
          >
            <CollapsibleTrigger
              disabled={!hasContent}
              className={cn(
                "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                hasContent ? "cursor-pointer hover:bg-muted/30" : "cursor-default"
              )}
            >
              {/* Step number badge */}
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-all duration-200",
                  isActive
                    ? "bg-primary/10 text-primary ring-2 ring-primary/20"
                    : "bg-muted text-muted-foreground/60"
                )}
              >
                {i + 1}
              </span>

              {/* Step label */}
              <span
                className={cn(
                  "flex-1 text-sm transition-colors",
                  isActive
                    ? "font-semibold text-foreground"
                    : "font-medium text-foreground/80"
                )}
              >
                {step.label}
                {step.detail && !hasContent && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {step.detail}
                  </span>
                )}
              </span>

              {/* Right indicator */}
              {isActive && (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
              )}
              {!isActive && hasContent && (
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform duration-200",
                    isOpen && "rotate-180"
                  )}
                />
              )}
            </CollapsibleTrigger>

            {hasContent && (
              <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
                <div className="border-t border-border/40 px-4 pb-4 pl-12 pt-3">
                  <StepContent label={step.label} content={step.content!} />
                </div>
              </CollapsibleContent>
            )}
          </Collapsible>
        );
      })}
    </div>
  );
}
