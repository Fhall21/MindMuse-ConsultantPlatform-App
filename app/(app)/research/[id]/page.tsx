"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronDown, Loader2, RotateCcw } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { EvidenceList } from "@/components/research/evidence-list";
import {
  FigureImageGrid,
  literatureFigureCaption,
} from "@/components/research/figure-image-grid";
import { ReasoningSteps, StepContent } from "@/components/research/reasoning-steps";
import { ReferencesList } from "@/components/research/references-list";
import { AnswerText } from "@/components/research/answer-text";
import { AnalysisSessionView } from "@/components/research/analysis-session-view";
import { ResearchExtractor } from "@/components/research/research-extractor";
import { ResearchExtractorHint } from "@/components/research/research-extractor-hint";
import { cn } from "@/lib/utils";
import { fetchJson } from "@/hooks/api";
import { useLiteratureResearch, useResearchSession } from "@/hooks/use-research";
import type {
  AnalysisResult,
  LiteratureResult,
  ReasoningStep,
} from "@/hooks/use-research";

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

// ── In-flight step accordion with live partial content ───────────────────────

function InFlightSteps({
  createdAt,
  isPending,
  partialSteps,
}: {
  createdAt: string;
  isPending: boolean;
  partialSteps: ReasoningStep[];
}) {
  const activeIndex = isPending ? 0 : inferActiveStep(createdAt);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const hasSetInitial = useRef(false);

  // Auto-open the last step that has content, once on first arrival
  useEffect(() => {
    if (!hasSetInitial.current && partialSteps.length > 0) {
      hasSetInitial.current = true;
      let last = -1;
      for (let i = 0; i < KNOWN_STEPS.length; i++) {
        const match = partialSteps.find((s) => s.label === KNOWN_STEPS[i].label);
        if (match?.content) last = i;
      }
      if (last >= 0) setOpenIndex(last);
    }
  }, [partialSteps.length]);

  return (
    <div className="divide-y divide-border/50 overflow-hidden rounded-lg border">
      {KNOWN_STEPS.map((step, i) => {
        const stepState: "done" | "active" | "upcoming" =
          isPending && i > 0
            ? "upcoming"
            : i < activeIndex
            ? "done"
            : i === activeIndex
            ? "active"
            : "upcoming";
        const partialStep = partialSteps.find((s) => s.label === step.label);
        const hasContent = Boolean(partialStep?.content) || Boolean(partialStep?.data);
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
                  "flex h-5 w-5 shrink-0 items-center justify-center text-[10px] font-bold transition-all duration-200",
                  stepState === "active"   && "text-primary",
                  stepState === "done"     && "text-muted-foreground/60",
                  stepState === "upcoming" && "text-muted-foreground/25"
                )}
              >
                {i + 1}
              </span>
              <span
                className={cn(
                  "flex-1 text-sm transition-colors",
                  stepState === "active"   && "font-semibold text-foreground",
                  stepState === "done"     && "font-medium text-muted-foreground/70",
                  stepState === "upcoming" && "font-medium text-muted-foreground/30"
                )}
              >
                {step.label}
                {stepState === "active" && !hasContent && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground/70">
                    {step.detail}
                  </span>
                )}
              </span>
              {stepState === "active" && (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
              )}
              {stepState !== "active" && hasContent && (
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
                  <StepContent
                    label={step.label}
                    content={partialStep?.content}
                    data={partialStep?.data}
                  />
                </div>
              </CollapsibleContent>
            )}
          </Collapsible>
        );
      })}
    </div>
  );
}

// ── Results view ──────────────────────────────────────────────────────────────

function ResultView({
  result,
  researchSessionId,
}: {
  result: LiteratureResult;
  researchSessionId: string;
}) {
  const [activeTab, setActiveTab] = useState("results");
  const answerHasTable = /^\s*\|/m.test(result.answer);
  const resultText =
    answerHasTable || !result.artifact
      ? result.answer
      : `${result.answer}\n\n## Summary framework\n${result.artifact}`;

  const handleCitationClick = useCallback((num: string) => {
    setActiveTab("references");
    setTimeout(() => {
      document.getElementById(`ref-${num}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 60);
  }, []);

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
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
        {(result.figures?.length ?? 0) > 0 && (
          <TabsTrigger value="figures">
            Figures
            <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
              {result.figures!.length}
            </Badge>
          </TabsTrigger>
        )}
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

      <TabsContent value="results" className="mt-3">
        <div className="border-t pt-4 space-y-4">
          <ResearchExtractorHint />
          <ResearchExtractor
            researchSessionId={researchSessionId}
            references={result.references}
          >
            <AnswerText
              text={resultText}
              references={result.references}
              evidence={result.evidence}
              onCitationClick={handleCitationClick}
            />
          </ResearchExtractor>
        </div>
      </TabsContent>

      <TabsContent value="reasoning" className="mt-3">
        <ReasoningSteps steps={result.reasoning_steps} />
      </TabsContent>

      {(result.figures?.length ?? 0) > 0 && (
        <TabsContent value="figures" className="mt-3">
          <FigureImageGrid
            variant="panel"
            images={result.figures!.map((fig) => ({ url: fig.url }))}
            getCaption={(idx) => literatureFigureCaption(result.figures![idx])}
          />
        </TabsContent>
      )}

      <TabsContent value="evidence" className="mt-3">
        <EvidenceList
          evidence={result.evidence}
          references={result.references}
          stats={result.stats}
          onJumpToReference={(num) => handleCitationClick(String(num))}
        />
      </TabsContent>

      <TabsContent value="references" className="mt-3">
        <ReferencesList
          references={result.references}
          onJumpToEvidence={() => setActiveTab("evidence")}
        />
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
  const research = useLiteratureResearch();

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

  // When the live SSE stream completes, refresh the DB-backed session query
  // so the page shows results from the authoritative source.
  useEffect(() => {
    if (research.status === "complete" || research.status === "error") {
      void qc.invalidateQueries({ queryKey: ["research-session", id] });
      void qc.invalidateQueries({ queryKey: ["research-sessions"] });
    }
  }, [research.status, id, qc]);

  const isInFlight = session?.status === "pending" || session?.status === "running";
  const isLiveActive = research.status !== "idle" && research.status !== "complete" && research.status !== "error";

  // The live result takes priority when the stream just completed; otherwise fall back to DB.
  const displayResult: LiteratureResult | null =
    research.status === "complete" && research.result
      ? research.result
      : (session?.resultData as LiteratureResult | null) ?? null;

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
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive">Could not load research session.</p>
        )}

        {session && session.sessionType === "analysis" && (
          <div className="max-w-5xl space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] tabular-nums text-muted-foreground/55 leading-none">
                  {new Date(session.createdAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground/60 leading-none">
                  Data analysis
                </span>
                {session.status === "pending" && (
                  <span className="text-[11px] text-muted-foreground/50 leading-none">
                    Queued
                  </span>
                )}
                {session.status === "failed" && (
                  <span className="text-[11px] text-destructive/60 leading-none">
                    Failed
                  </span>
                )}
                {session.status === "cancelled" && (
                  <span className="text-[11px] text-muted-foreground/50 leading-none">
                    Cancelled
                  </span>
                )}
              </div>
              <div className="flex items-start gap-3">
                {(session.status === "pending" || session.status === "running") && (
                  <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/70" />
                  </div>
                )}
                <h1 className="text-xl font-semibold tracking-tight leading-snug">
                  {session.query}
                </h1>
              </div>
            </div>
            <AnalysisSessionView
              sessionId={id}
              status={session.status}
              resultData={session.resultData as AnalysisResult | null}
              createdAt={session.createdAt}
            />
          </div>
        )}

        {session && session.sessionType !== "analysis" && (
          <>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] tabular-nums text-muted-foreground/55 leading-none">
                  {new Date(session.createdAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                {session.status === "pending" && !isLiveActive && (
                  <span className="text-[11px] text-muted-foreground/50 leading-none">Queued</span>
                )}
                {session.status === "failed" && !isLiveActive && (
                  <span className="text-[11px] text-destructive/60 leading-none">Failed</span>
                )}
                {session.status === "cancelled" && !isLiveActive && (
                  <span className="text-[11px] text-muted-foreground/50 leading-none">Cancelled</span>
                )}
                {research.status === "reconnecting" && (
                  <span className="text-[11px] text-muted-foreground/60 leading-none">Reconnecting…</span>
                )}
              </div>
              <div className="flex items-start gap-3">
                {(isInFlight || isLiveActive) && research.status !== "reconnecting" && (
                  <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/70" />
                  </div>
                )}
                {research.status === "reconnecting" && (
                  <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center">
                    <RotateCcw className="h-4 w-4 animate-spin text-muted-foreground/50" />
                  </div>
                )}
                <h1 className="text-xl font-semibold tracking-tight leading-snug">{session.query}</h1>
              </div>
            </div>

            {/* Live reconnecting banner */}
            {research.status === "reconnecting" && (
              <div className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/30 px-3 py-2.5">
                <RotateCcw className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground/60" />
                <p className="text-sm text-muted-foreground">
                  Connection dropped — attempting to reconnect.
                </p>
              </div>
            )}

            {/* Live SSE in-flight: show live reasoning steps */}
            {isLiveActive && research.status !== "reconnecting" && (
              <div className="space-y-3">
                <InFlightSteps
                  createdAt={session.createdAt}
                  isPending={research.status === "submitted"}
                  partialSteps={research.reasoningSteps}
                />
                {research.isCancellable && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => research.cancel()}
                    className="text-muted-foreground h-7 px-2 text-xs"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            )}

            {/* DB in-flight (no live connection): show static step accordion */}
            {isInFlight && !isLiveActive && (
              <div className="space-y-3">
                <InFlightSteps
                  createdAt={session.createdAt}
                  isPending={session.status === "pending"}
                  partialSteps={
                    (
                      session.resultData as
                        | { partial_reasoning_steps?: ReasoningStep[] }
                        | null
                    )?.partial_reasoning_steps ?? []
                  }
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

            {/* Failed — offer reconnect */}
            {session.status === "failed" && !isLiveActive && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {(session.resultData as { error?: string } | null)?.error ??
                    "The search did not complete. Edison may have finished in the background — reconnect to retrieve the result."}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => research.reconnectSession(id, session.query)}
                  className="gap-2"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reconnect
                </Button>
              </div>
            )}

            {/* Live error (reconnect exhausted) */}
            {research.status === "error" && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {research.error ?? "Reconnection failed."}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => research.reconnectSession(id, session.query)}
                  className="gap-2"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Try again
                </Button>
              </div>
            )}

            {/* Cancelled */}
            {session.status === "cancelled" && !isLiveActive && (
              <p className="text-sm text-muted-foreground">Search was cancelled.</p>
            )}

            {/* Complete — live result or DB result */}
            {(session.status === "complete" || research.status === "complete") && displayResult && (
              <ResultView result={displayResult} researchSessionId={id} />
            )}
            {session.status === "complete" && !displayResult && (
              <p className="text-sm text-muted-foreground">No results were returned for this search.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
