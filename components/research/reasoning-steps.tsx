"use client";

import { useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { ReasoningStep } from "@/hooks/use-research";

interface ReasoningStepsProps {
  steps: ReasoningStep[];
  isLoading?: boolean;
}

// Render step content: plan objectives as a list, search queries as lines,
// artifact tables as a table, everything else as plain text.
function StepContent({ label, content }: { label: string; content: string }) {
  // Plan objectives: lines starting with ✓ → / ○
  if (label === "Planning research") {
    const lines = content.split("\n").filter(Boolean);
    return (
      <ul className="space-y-1">
        {lines.map((line, i) => {
          const icon = line[0];
          const text = line.slice(2).trim();
          const done = icon === "✓";
          const active = icon === "→";
          return (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span className={done ? "text-green-500" : active ? "text-primary" : "text-muted-foreground"}>
                {icon}
              </span>
              <span className={done ? "text-muted-foreground line-through" : active ? "text-foreground font-medium" : "text-muted-foreground"}>
                {text}
              </span>
            </li>
          );
        })}
      </ul>
    );
  }

  // Search queries: "query" → papers
  if (label === "Searching literature") {
    const lines = content.split("\n").filter(Boolean);
    return (
      <ul className="space-y-1.5">
        {lines.map((line, i) => {
          const [query, papers] = line.split(" → ");
          return (
            <li key={i} className="text-sm">
              <span className="font-medium text-foreground">{query}</span>
              {papers && (
                <span className="text-muted-foreground"> → {papers}</span>
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  // Artifact: markdown table → render as HTML table
  if (label === "Synthesising findings" && content.startsWith("|")) {
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
        <div className="overflow-x-auto rounded border text-xs">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                {headers.map((h, hi) => (
                  <th key={hi} className="px-2 py-1.5 text-left font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, ri) => (
                <tr key={ri} className="border-t">
                  {parseRow(row).map((cell, ci) => (
                    <td key={ci} className="px-2 py-1.5 text-muted-foreground">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
  }

  // Default: plain text
  return <p className="text-sm text-muted-foreground whitespace-pre-wrap">{content}</p>;
}

export function ReasoningSteps({ steps, isLoading = false }: ReasoningStepsProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (steps.length === 0) {
    if (!isLoading) return null;
    return (
      <p className="text-sm text-muted-foreground">Waiting for first steps…</p>
    );
  }

  return (
    <div className="w-full space-y-1">
      {steps.map((step, i) => {
        const isActive = isLoading && i === steps.length - 1;
        const hasContent = Boolean(step.content);
        return (
          <Collapsible
            key={i}
            open={openIndex === i}
            onOpenChange={(open) => setOpenIndex(open ? i : null)}
          >
            <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-medium hover:bg-muted/50 transition-colors">
              {isActive ? (
                <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
              ) : (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs font-semibold text-muted-foreground">
                  {i + 1}
                </span>
              )}
              <span className={`flex-1 ${isActive ? "text-primary" : ""}`}>
                {step.label}
              </span>
              {!isActive && (hasContent || step.detail) && (
                <ChevronDown
                  className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200"
                  style={{ transform: openIndex === i ? "rotate(180deg)" : "rotate(0deg)" }}
                />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-none">
              <div className="pb-3 pl-9 pr-2">
                {hasContent ? (
                  <StepContent label={step.label} content={step.content!} />
                ) : (
                  <p className="text-sm text-muted-foreground">{step.detail}</p>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}
