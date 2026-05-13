"use client";

import Link from "next/link";
import { use } from "react";
import { ArrowLeft, Check, Circle, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EvidenceList } from "@/components/research/evidence-list";
import { ReasoningSteps } from "@/components/research/reasoning-steps";
import { ReferencesList } from "@/components/research/references-list";
import { fetchJson } from "@/hooks/api";
import { useResearchSession } from "@/hooks/use-research";
import type { LiteratureResult, ReasoningStep } from "@/hooks/use-research";

// ── Canonical step sequence (mirrors backend TOOL_LABELS order) ───────────────

const KNOWN_STEPS: { label: string; detail: string }[] = [
  { label: "Planning research",    detail: "Breaking down the question into targeted sub-queries." },
  { label: "Searching literature", detail: "Searching academic databases for relevant papers." },
  { label: "Reading sources",      detail: "Reviewing and evaluating paper content in detail." },
  { label: "Gathering evidence",   detail: "Extracting and scoring relevant evidence excerpts." },
  { label: "Synthesising findings",detail: "Building a structured summary of the evidence." },
];

// Mirrors _polling_message thresholds in research.py
const STEP_THRESHOLDS = [0, 20, 45, 75, 105]; // seconds at which each step becomes active

function inferActiveStep(createdAt: string): number {
  const elapsed = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
  let active = 0;
  for (let i = 0; i < STEP_THRESHOLDS.length; i++) {
    if (elapsed >= STEP_THRESHOLDS[i]) active = i;
  }
  return active;
}

// ── Step cards ─────────────────────────────────────────────────────────────────

interface StepCardProps {
  index: number;
  label: string;
  detail?: string;
  state: "done" | "active" | "upcoming";
}

function StepCard({ index, label, detail, state }: StepCardProps) {
  return (
    <div
      className={[
        "flex items-center gap-3 rounded-md border px-3 py-2.5 transition-colors",
        state === "active" ? "border-border bg-background" : "border-border/50",
      ].join(" ")}
    >
      <span
        className={[
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          state === "done"     ? "bg-muted text-muted-foreground/60" :
          state === "active"   ? "bg-primary/10 text-primary" :
                                 "bg-muted/50 text-muted-foreground/30",
        ].join(" ")}
      >
        {index + 1}
      </span>
      <span
        className={[
          "flex-1 text-sm",
          state === "done"   ? "text-muted-foreground/60" :
          state === "active" ? "font-medium text-foreground" :
                               "text-muted-foreground/40",
        ].join(" ")}
      >
        {label}
        {detail && state === "active" && (
          <span className="ml-1.5 font-normal text-muted-foreground">{detail}</span>
        )}
      </span>
      {state === "done" && (
        <Check className="h-3.5 w-3.5 shrink-0 text-green-500" />
      )}
      {state === "active" && (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
      )}
      {state === "upcoming" && (
        <Circle className="h-3 w-3 shrink-0 text-muted-foreground/20" />
      )}
    </div>
  );
}

// In-flight: infer step from elapsed time, show full roadmap
function InFlightSteps({ createdAt, isPending }: { createdAt: string; isPending: boolean }) {
  const activeIndex = isPending ? 0 : inferActiveStep(createdAt);
  return (
    <div className="space-y-1.5">
      {KNOWN_STEPS.map((step, i) => (
        <StepCard
          key={i}
          index={i}
          label={step.label}
          detail={step.detail}
          state={isPending && i > 0 ? "upcoming" : i < activeIndex ? "done" : i === activeIndex ? "active" : "upcoming"}
        />
      ))}
    </div>
  );
}

// Complete: actual steps from result_data, all done, with detail if available
function CompletedSteps({ steps }: { steps: ReasoningStep[] }) {
  if (steps.length === 0) {
    // Fallback: show canonical steps all done
    return (
      <div className="space-y-1.5">
        {KNOWN_STEPS.map((step, i) => (
          <StepCard key={i} index={i} label={step.label} state="done" />
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      {steps.map((step, i) => (
        <StepCard key={i} index={i} label={step.label} state="done" />
      ))}
    </div>
  );
}

// ── Local display helpers ─────────────────────────────────────────────────────

function AnswerText({ text }: { text: string }) {
  const blocks = text.split(/\n\n+/);
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {blocks.map((block, bi) => {
        const trimmed = block.trim();
        if (!trimmed) return null;
        const h2 = /^## (.+)/.exec(trimmed);
        if (h2) return <h3 key={bi} className="text-base font-semibold pt-1">{h2[1]}</h3>;
        const h3 = /^### (.+)/.exec(trimmed);
        if (h3) return <h4 key={bi} className="text-sm font-semibold">{h3[1]}</h4>;
        const parts = trimmed.split(/(\[\d+(?:,\s*\d+)*\])/g);
        return (
          <p key={bi}>
            {parts.map((part, pi) => {
              const citMatch = /^\[(\d+(?:,\s*\d+)*)\]$/.exec(part);
              if (citMatch) {
                return (
                  <span key={pi}>
                    {citMatch[1].split(",").map((n) => (
                      <Badge
                        key={n.trim()}
                        variant="outline"
                        className="mx-0.5 px-1 py-0 text-xs font-semibold align-super"
                      >
                        {n.trim()}
                      </Badge>
                    ))}
                  </span>
                );
              }
              return <span key={pi}>{part}</span>;
            })}
          </p>
        );
      })}
    </div>
  );
}

function ArtifactTable({ markdown }: { markdown: string }) {
  const rows = markdown
    .split("\n")
    .map((r) => r.trim())
    .filter((r) => r.startsWith("|") && !r.match(/^\|[-| ]+\|$/));
  if (rows.length < 2) return null;
  const parseRow = (row: string) =>
    row.split("|").slice(1, -1).map((c) => c.trim());
  const [headerRow, ...bodyRows] = rows;
  const headers = parseRow(headerRow);
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="px-3 py-2 text-left font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bodyRows.map((row, ri) => (
            <tr key={ri} className="border-t">
              {parseRow(row).map((cell, ci) => (
                <td key={ci} className="px-3 py-2 text-muted-foreground">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === "pending")
    return <Badge variant="secondary" className="text-xs font-normal text-muted-foreground">Queued</Badge>;
  if (status === "running")
    return (
      <Badge variant="secondary" className="gap-1 text-xs font-normal text-blue-700 dark:text-blue-300">
        <Loader2 className="h-3 w-3 animate-spin" /> Searching
      </Badge>
    );
  if (status === "failed")
    return <Badge variant="outline" className="text-xs border-destructive/40 text-destructive">Failed</Badge>;
  if (status === "cancelled")
    return <Badge variant="outline" className="text-xs border-border text-muted-foreground">Cancelled</Badge>;
  return null;
}

// ── Results view ──────────────────────────────────────────────────────────────

function ResultView({ result }: { result: LiteratureResult }) {
  return (
    <Tabs defaultValue="results">
      <TabsList>
        <TabsTrigger value="results">Results</TabsTrigger>
        <TabsTrigger value="reasoning">
          Reasoning
          {result.reasoning_steps.length > 0 && (
            <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
              {result.reasoning_steps.length}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="evidence">
          Evidence
          {result.evidence.length > 0 && (
            <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
              {result.evidence.length}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="references">
          References
          {result.references.length > 0 && (
            <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
              {result.references.length}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="results" className="mt-3 space-y-4">
        {result.artifact && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Summary</p>
            <ArtifactTable markdown={result.artifact} />
          </div>
        )}
        <div className="border-t pt-4">
          <AnswerText text={result.answer} />
        </div>
      </TabsContent>

      <TabsContent value="reasoning" className="mt-3">
        <ReasoningSteps steps={result.reasoning_steps} />
      </TabsContent>

      <TabsContent value="evidence" className="mt-3">
        <EvidenceList evidence={result.evidence} />
      </TabsContent>

      <TabsContent value="references" className="mt-3">
        <ReferencesList references={result.references} />
      </TabsContent>
    </Tabs>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ResearchSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: session, isLoading, error } = useResearchSession(id);
  const qc = useQueryClient();
  const cancelMutation = useMutation({
    mutationFn: () =>
      fetchJson(`/api/research/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["research-session", id] });
      void qc.invalidateQueries({ queryKey: ["research-sessions"] });
    },
  });
  const isInFlight = session?.status === "pending" || session?.status === "running";

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Link
          href="/research"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Research
        </Link>

        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-4 w-24" />
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive">Could not load research session.</p>
        )}

        {session && (
          <>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight">{session.query}</h1>
                <StatusBadge status={session.status} />
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(session.createdAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>

            {/* In-flight: step roadmap with live active inference */}
            {isInFlight && (
              <div className="space-y-3">
                <InFlightSteps
                  createdAt={session.createdAt}
                  isPending={session.status === "pending"}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => cancelMutation.mutate()}
                  disabled={cancelMutation.isPending}
                  className="text-muted-foreground h-7 px-2 text-xs"
                >
                  Cancel
                </Button>
              </div>
            )}

            {/* Failed */}
            {session.status === "failed" && (
              <p className="text-sm text-destructive">
                {(session.resultData as { error?: string } | null)?.error ??
                  "Search failed. Please try again."}
              </p>
            )}

            {/* Cancelled */}
            {session.status === "cancelled" && (
              <p className="text-sm text-muted-foreground">Search was cancelled.</p>
            )}

            {/* Complete */}
            {session.status === "complete" && session.resultData && (
              <ResultView result={session.resultData as unknown as LiteratureResult} />
            )}
            {session.status === "complete" && !session.resultData && (
              <p className="text-sm text-muted-foreground">No results were returned for this search.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
