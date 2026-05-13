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

interface ReasoningStepsProps {
  steps: ReasoningStep[];
  isLoading?: boolean;
}

function splitBlocks(content: string) {
  return content
    .split(/\n\s*\n+/)
    .map((block) => block.trim())
    .filter(Boolean);
}

function splitLines(content: string) {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function looksLikeTable(content: string) {
  const lines = splitLines(content);
  return lines.length >= 2 && lines.some((line) => line.startsWith("|"));
}

function parseTable(markdown: string) {
  const rows = markdown
    .split("\n")
    .map((row) => row.trim())
    .filter((row) => row.startsWith("|") && !row.match(/^\|[-| ]+\|$/));

  if (rows.length < 2) return null;

  const parseRow = (row: string) =>
    row.split("|").slice(1, -1).map((cell) => cell.trim());

  const [headerRow, ...bodyRows] = rows;
  return {
    headers: parseRow(headerRow),
    bodyRows: bodyRows.map(parseRow),
  };
}

function inferStepKind(label: string, content: string) {
  const normalizedLabel = label.toLowerCase();
  if (normalizedLabel.includes("plan")) return "planning";
  if (normalizedLabel.includes("search")) return "search";
  if (normalizedLabel.includes("synth") || looksLikeTable(content)) return "table";
  if (/^\s*(?:[-*•]|\d+[.)]|[✓→○])\s+/m.test(content)) return "list";
  return "plain";
}

function splitArrowLine(line: string) {
  const match = line.match(/^(.*?)(?:\s*(?:→|=>|->)\s*)(.*)$/);
  if (!match) return [line, ""];
  return [match[1].trim(), match[2].trim()];
}

function ContentSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}

function BulletList({ lines }: { lines: string[] }) {
  return (
    <ul className="space-y-2">
      {lines.map((line, i) => {
        const marker = line.match(/^(?:[-*•]|\d+[.)]|[✓→○])/);
        const icon = marker ? marker[0] : "•";
        const text = line.slice(marker?.[0].length ?? 0).trim();
        const done = icon === "✓";
        const active = icon === "→";

        return (
          <li key={i} className="flex items-start gap-2 text-sm leading-6">
            <span
              className={cn(
                "mt-[1px] flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                done && "bg-green-500/15 text-green-600",
                active && "bg-primary/10 text-primary",
                !done && !active && "text-muted-foreground/30"
              )}
            >
              {done ? "✓" : active ? "→" : "·"}
            </span>
            <span
              className={cn(
                "leading-6",
                done && "text-muted-foreground/60 line-through",
                active && "font-medium text-foreground",
                !done && !active && "text-muted-foreground/50"
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

function renderPlainBlock(block: string) {
  const lines = splitLines(block);
  if (lines.length === 0) return null;

  if (lines.every((line) => /^(?:[-*•]|\d+[.)]|[✓→○])\s+/.test(line))) {
    return <BulletList lines={lines} />;
  }

  const heading = lines[0].match(/^#{2,6}\s+(.+)/);
  if (heading) {
    return (
      <div className="space-y-1.5">
        <p className="text-sm font-semibold leading-6 text-foreground">{heading[1]}</p>
        {lines.slice(1).length > 0 && (
          <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
            {lines.slice(1).join("\n")}
          </p>
        )}
      </div>
    );
  }

  return (
    <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
      {lines.join("\n")}
    </p>
  );
}

function StepContent({ label, content }: { label: string; content: string }) {
  const kind = inferStepKind(label, content);

  if (kind === "planning") {
    const blocks = splitBlocks(content);
    return (
      <div className="space-y-3">
        {blocks.map((block, blockIndex) => (
          <ContentSection
            key={blockIndex}
            title={blockIndex === 0 ? "Checklist" : `Update ${blockIndex + 1}`}
          >
            <BulletList lines={splitLines(block)} />
          </ContentSection>
        ))}
      </div>
    );
  }

  if (kind === "search") {
    const lines = splitLines(content);
    return (
      <div className="space-y-2.5">
        {lines.map((line, i) => {
          const [query, papers] = splitArrowLine(line);
          return (
            <div
              key={i}
              className="space-y-1.5 rounded-lg border border-border/60 bg-muted/15 px-3 py-3"
            >
              <p className="text-sm font-medium leading-6 text-foreground">{query}</p>
              {papers && <p className="text-sm leading-6 text-muted-foreground">{papers}</p>}
            </div>
          );
        })}
      </div>
    );
  }

  const table = kind === "table" ? parseTable(content) : null;
  if (table) {
    return (
      <div className="overflow-x-auto rounded-lg border border-border/60 bg-background text-xs">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              {table.headers.map((header, headerIndex) => (
                <th key={headerIndex} className="px-3 py-2 text-left font-semibold leading-5">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.bodyRows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-t align-top">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-3 py-2.5 leading-5 text-muted-foreground">
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

  return (
    <div className="space-y-3 text-sm leading-6 text-muted-foreground">
      {splitBlocks(content).map((block, i) => (
        <div key={i}>{renderPlainBlock(block)}</div>
      ))}
    </div>
  );
}

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

              {isActive && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />}
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
                <div className="border-t border-border/40 bg-muted/20 px-4 pb-5 pl-12 pt-4">
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
