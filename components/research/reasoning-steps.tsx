"use client";

import { useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  normalizeTableBlock,
  parseTableRow,
} from "@/lib/markdown-table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ReasoningPlanTable } from "@/components/research/_reasoning-plan-table";
import { ReasoningEvidenceQuotes } from "@/components/research/_reasoning-evidence-quotes";
import { FigureImageGrid } from "@/components/research/figure-image-grid";
import type {
  ArtifactStepData,
  FiguresStepData,
  LiteratureStats,
  ReadStepData,
  ReasoningStep,
  ReasoningStepData,
  SearchStepData,
} from "@/hooks/use-research";

// ── Content renderers (exported for InFlightSteps on detail page) ─────────────

function ArtifactStatsFooter({ stats }: { stats: LiteratureStats }) {
  const Tile = ({ label, value }: { label: string; value: number }) => (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80">
        {label}
      </span>
      <span
        className={cn(
          "text-base font-semibold tabular-nums leading-none",
          value === 0 ? "text-muted-foreground/40" : "text-foreground"
        )}
      >
        {value}
      </span>
    </div>
  );
  return (
    <div className="mt-4 grid grid-cols-2 gap-3 rounded-md border bg-card/40 p-3 sm:grid-cols-4">
      <Tile label="Papers screened" value={stats.paper_count} />
      <Tile label="Relevant papers" value={stats.relevant_papers} />
      <Tile label="Current evidence" value={stats.current_evidence} />
      <Tile label="Clinical trials" value={stats.clinical_trial_count} />
    </div>
  );
}

function SearchRows({ data }: { data: SearchStepData }) {
  return (
    <ul className="divide-y divide-border/30">
      {data.queries.map((q, i) => (
        <li key={i} className="py-3 first:pt-0 last:pb-0">
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <p className="text-sm font-medium text-foreground/90">{q.query}</p>
            <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/60">
              {q.count} {q.count === 1 ? "paper" : "papers"}
            </span>
          </div>
          {q.papers.length > 0 && (
            <ul className="space-y-1.5">
              {q.papers.slice(0, 5).map((p, j) => {
                const meta = [p.year, p.journal].filter(Boolean).join(" · ");
                return (
                  <li key={j} className="text-xs leading-snug">
                    <p className="text-foreground/85">{p.title}</p>
                    {(meta || p.authors || p.chunk_count) && (
                      <p className="mt-0.5 text-muted-foreground">
                        {p.authors && (
                          <span className="line-clamp-1">{p.authors}</span>
                        )}
                        {(meta || p.chunk_count) && (
                          <span>
                            {meta}
                            {p.chunk_count != null && (
                              <span className="text-muted-foreground/60">
                                {meta ? " · " : ""}
                                {p.chunk_count} chunks
                              </span>
                            )}
                          </span>
                        )}
                      </p>
                    )}
                  </li>
                );
              })}
              {q.papers.length > 5 && (
                <li className="text-xs text-muted-foreground/50">
                  +{q.papers.length - 5} more
                </li>
              )}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

function FigureRounds({ data }: { data: FiguresStepData }) {
  return (
    <ul className="space-y-3">
      {data.rounds.map((r, i) => (
        <li key={i} className="space-y-1">
          <div className="flex items-baseline gap-2 text-[10px] uppercase tracking-wider text-muted-foreground/70">
            <span className="tabular-nums">
              {r.image_count} {r.image_count === 1 ? "figure" : "figures"}
            </span>
            <span className="text-muted-foreground/30">·</span>
            <span className="normal-case font-mono tracking-normal text-muted-foreground/80">
              {r.citation_key}
            </span>
          </div>
          {r.query && (
            <p className="text-xs italic text-muted-foreground">“{r.query}”</p>
          )}
          {r.description && (
            <p className="text-xs leading-relaxed text-foreground/85">
              {r.description}
            </p>
          )}
          {r.images && r.images.length > 0 && (
            <FigureImageGrid
              images={r.images}
              getCaption={(idx) =>
                r.images!.length > 1
                  ? `${r.citation_key} · figure ${idx + 1}`
                  : r.citation_key
              }
            />
          )}
        </li>
      ))}
    </ul>
  );
}

function ReadPapers({ data }: { data: ReadStepData }) {
  return (
    <ul className="space-y-3">
      {data.papers.map((p, i) => (
        <li key={i} className="space-y-1">
          <p className="text-sm font-medium leading-snug text-foreground">{p.title}</p>
          {p.takeaway && (
            <p className="text-xs leading-relaxed text-muted-foreground border-l border-border/60 pl-3">
              {p.takeaway}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

function ArtifactBlock({ data }: { data: ArtifactStepData }) {
  return (
    <div className="space-y-3">
      <MarkdownTable raw={data.table_markdown} />
      {data.stats && <ArtifactStatsFooter stats={data.stats} />}
    </div>
  );
}

function MarkdownTable({ raw }: { raw: string }) {
  const { rows, isValid } = normalizeTableBlock(raw.split("\n"));
  if (!isValid) {
    return <p className="whitespace-pre-wrap text-sm text-muted-foreground">{raw}</p>;
  }

  const [headerRow, ...bodyRows] = rows;
  const headers = parseTableRow(headerRow);
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
              {parseTableRow(row).map((cell, ci) => (
                <td key={ci} className="py-2 pr-4 align-top text-muted-foreground">
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

function StructuredStepContent({ data }: { data: ReasoningStepData }) {
  switch (data.kind) {
    case "plan":
      return <ReasoningPlanTable data={data} />;
    case "search":
      return <SearchRows data={data} />;
    case "gather":
      return <ReasoningEvidenceQuotes data={data} />;
    case "figures":
      return <FigureRounds data={data} />;
    case "read":
      return <ReadPapers data={data} />;
    case "artifact":
      return <ArtifactBlock data={data} />;
  }
}

export function StepContent({
  label,
  content,
  data,
}: {
  label: string;
  content?: string;
  data?: ReasoningStepData;
}) {
  if (data) {
    return <StructuredStepContent data={data} />;
  }
  if (!content) return null;
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
    return <MarkdownTable raw={content} />;
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
        const hasContent = Boolean(step.content) || Boolean(step.data);
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
              {/* Step number */}
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center text-[10px] font-bold transition-all duration-200",
                  isActive ? "text-primary" : "text-muted-foreground/60"
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
                  <StepContent label={step.label} content={step.content} data={step.data} />
                </div>
              </CollapsibleContent>
            )}
          </Collapsible>
        );
      })}
    </div>
  );
}
