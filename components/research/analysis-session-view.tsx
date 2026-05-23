"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  Database,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { fetchJson } from "@/hooks/api";
import { useDataAnalysis } from "@/hooks/use-research";
import type {
  AnalysisArtifact,
  AnalysisNotebookCell,
  AnalysisResult,
} from "@/hooks/use-research";
import { cn } from "@/lib/utils";
import { NotebookCells } from "./notebook-cells";
import {
  AnalysisSummaryContent,
  ArtifactPreviewCard,
} from "./analysis-artifact-preview";

// ── Canonical analysis stages ─────────────────────────────────────────────────
// Mirrors the literature InFlightSteps pattern: a fixed list of phases with
// done/active/upcoming visual states. Active phase is inferred from elapsed
// time AND from observable signals (cell count, status). Cell count is the
// strongest signal — once cells start appearing we know we're past dataset
// loading.

const ANALYSIS_STAGES: { label: string; detail: string }[] = [
  {
    label: "Queued for analysis",
    detail: "Waiting for the analysis worker to pick up the job.",
  },
  {
    label: "Reading dataset",
    detail: "Provisioning a notebook kernel and loading your CSV files.",
  },
  {
    label: "Running notebook cells",
    detail: "Edison is exploring the data and producing intermediate cells.",
  },
  {
    label: "Synthesising findings",
    detail: "Drafting the final answer and packaging artifacts.",
  },
];

// Time thresholds (seconds) at which each step *would* become active in the
// absence of stronger signals. Tuned roughly to Edison analysis pacing.
const STAGE_TIME_THRESHOLDS = [0, 12, 35, 150];

interface InferStageInput {
  status: "pending" | "running" | "complete" | "failed" | "cancelled";
  elapsedSeconds: number;
  cells: AnalysisNotebookCell[];
}

function inferActiveStage({ status, elapsedSeconds, cells }: InferStageInput): number {
  if (status === "pending") return 0;
  if (status === "complete") return ANALYSIS_STAGES.length - 1;
  if (status === "cancelled" || status === "failed") {
    // Whatever stage we were last in — best-effort from cells.
    if (cells.length === 0) return 1;
    return 2;
  }

  // status === "running"
  // Strongest signal: cells executed.
  if (cells.length === 0) {
    // Reading dataset / kernel provisioning.
    return elapsedSeconds < STAGE_TIME_THRESHOLDS[1] ? 1 : 1;
  }

  // Synthesising heuristic: very late in run, lots of cells, or last cell
  // display text mentions summary / conclusion.
  const last = cells[cells.length - 1];
  const lastText = (last?.display_text || "").toLowerCase();
  const looksLikeSummary =
    lastText.includes("summary") ||
    lastText.includes("conclusion") ||
    lastText.includes("final answer");
  if (
    looksLikeSummary ||
    elapsedSeconds >= STAGE_TIME_THRESHOLDS[3] ||
    cells.length >= 5
  ) {
    return 3;
  }
  return 2;
}

interface InFlightAnalysisStagesProps {
  status: "pending" | "running" | "complete" | "failed" | "cancelled";
  elapsedSeconds: number;
  cells: AnalysisNotebookCell[];
  isLive: boolean;
}

function InFlightAnalysisStages({
  status,
  elapsedSeconds,
  cells,
  isLive,
}: InFlightAnalysisStagesProps) {
  const activeIndex = inferActiveStage({ status, elapsedSeconds, cells });
  const hasNotebookContent = cells.length > 0;

  // Default the "Running notebook cells" stage open. The CollapsibleTrigger is
  // disabled when there are no cells so the open state is invisible until
  // cells arrive — at which point the panel reveals naturally.
  const [openIndex, setOpenIndex] = useState<number | null>(2);

  return (
    <div className="divide-y divide-border/50 overflow-hidden rounded-lg border">
      {ANALYSIS_STAGES.map((stage, i) => {
        const stepState: "done" | "active" | "upcoming" =
          i < activeIndex ? "done" : i === activeIndex ? "active" : "upcoming";

        // Step 2 ("Running notebook cells") is the one with collapsible content.
        const isContentStep = i === 2;
        const hasContent = isContentStep && hasNotebookContent;
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
                  stepState === "active" && "text-primary",
                  stepState === "done" && "text-muted-foreground/60",
                  stepState === "upcoming" && "text-muted-foreground/25"
                )}
              >
                {i + 1}
              </span>
              <span
                className={cn(
                  "flex-1 text-sm transition-colors",
                  stepState === "active" && "font-semibold text-foreground",
                  stepState === "done" && "font-medium text-muted-foreground/70",
                  stepState === "upcoming" && "font-medium text-muted-foreground/30"
                )}
              >
                {stage.label}
                {stepState === "active" && !hasContent && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground/70">
                    {stage.detail}
                  </span>
                )}
                {isContentStep && hasNotebookContent && (
                  <Badge
                    variant="secondary"
                    className="ml-2 px-1.5 py-0 text-[10px]"
                  >
                    {cells.length} cell{cells.length === 1 ? "" : "s"}
                  </Badge>
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
                <div className="border-t border-border/40 bg-muted/20 px-4 pb-4 pl-12 pt-3">
                  <NotebookCells cells={cells} isLive={isLive} variant="panel" />
                </div>
              </CollapsibleContent>
            )}
          </Collapsible>
        );
      })}
    </div>
  );
}

// ── Result tabs ───────────────────────────────────────────────────────────────

function ArtifactRows({
  artifacts,
  researchSessionId,
}: {
  artifacts: AnalysisArtifact[];
  researchSessionId?: string;
}) {
  if (!artifacts || artifacts.length === 0) {
    return <p className="text-sm text-muted-foreground">No artifacts produced.</p>;
  }
  return (
    <ul className="space-y-2">
      {artifacts.map((art, idx) => (
        <li key={`${art.entry_id}-${idx}`}>
          <ArtifactPreviewCard
            artifact={art}
            researchSessionId={researchSessionId}
            sessionType="analysis"
            artifacts={artifacts}
          />
        </li>
      ))}
    </ul>
  );
}

function ResultTabs({
  result,
  researchSessionId,
}: {
  result: AnalysisResult;
  researchSessionId: string;
}) {
  const [activeTab, setActiveTab] = useState<"summary" | "notebook" | "artifacts">(
    "summary"
  );
  const cells = result.notebook_cells ?? [];
  const artifacts = result.artifacts ?? [];

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => setActiveTab(v as typeof activeTab)}
      className="min-w-0 w-full"
    >
      <TabsList>
        <TabsTrigger value="summary">Summary</TabsTrigger>
        <TabsTrigger value="notebook">
          Notebook
          <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
            {cells.length}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="artifacts">
          Artifacts
          {artifacts.length > 0 && (
            <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
              {artifacts.length}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="summary" className="mt-3 min-w-0">
        <AnalysisSummaryContent
          result={result}
          researchSessionId={researchSessionId}
          sessionType="analysis"
        />
      </TabsContent>

      <TabsContent value="notebook" className="mt-3 min-w-0">
        <div className="rounded-lg border bg-card p-3">
          <NotebookCells cells={cells} variant="detail" />
        </div>
      </TabsContent>

      <TabsContent value="artifacts" className="mt-3 min-w-0">
        <ArtifactRows artifacts={artifacts} researchSessionId={researchSessionId} />
      </TabsContent>
    </Tabs>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

interface AnalysisSessionViewProps {
  sessionId: string;
  status: "pending" | "running" | "complete" | "failed" | "cancelled";
  resultData: AnalysisResult | null;
  createdAt: string;
}

export function AnalysisSessionView({
  sessionId,
  status,
  resultData,
  createdAt,
}: AnalysisSessionViewProps) {
  const qc = useQueryClient();
  const analysis = useDataAnalysis();

  // When the live SSE stream completes, refresh the DB-backed session query
  // so the page shows results from the authoritative source.
  useEffect(() => {
    if (analysis.status === "complete" || analysis.status === "error") {
      void qc.invalidateQueries({ queryKey: ["research-session", sessionId] });
      void qc.invalidateQueries({ queryKey: ["research-sessions"] });
    }
  }, [analysis.status, sessionId, qc]);

  const cancelMutation = useMutation({
    mutationFn: () =>
      fetchJson(`/api/research/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["research-session", sessionId] });
      void qc.invalidateQueries({ queryKey: ["research-sessions"] });
    },
  });

  const isInFlight = status === "pending" || status === "running";
  const isLiveActive =
    analysis.status !== "idle" &&
    analysis.status !== "complete" &&
    analysis.status !== "error";

  // Result: prefer live stream when it just completed, else DB.
  const displayResult: AnalysisResult | null =
    analysis.status === "complete" && analysis.result
      ? analysis.result
      : resultData;

  // Cells: prefer live stream cells, else DB partial cells.
  const cells: AnalysisNotebookCell[] = useMemo(() => {
    if (analysis.notebookCells.length > 0) return analysis.notebookCells;
    return (
      (resultData as { partial_notebook_cells?: AnalysisNotebookCell[] } | null)
        ?.partial_notebook_cells ?? []
    );
  }, [analysis.notebookCells, resultData]);

  // Ticking clock for the local elapsed-seconds fallback. Only ticks while
  // the session is in-flight; pauses to avoid pointless re-renders otherwise.
  // The interval callback is the only place we call Date.now() — keeps the
  // effect body free of impure calls and synchronous setState.
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!isInFlight) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isInFlight]);

  // Elapsed: prefer live timer; else compute from createdAt + ticking clock.
  const elapsedSeconds = useMemo(() => {
    if (analysis.elapsedSeconds > 0) return analysis.elapsedSeconds;
    if (!isInFlight || now === 0) return 0;
    return Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 1000));
  }, [analysis.elapsedSeconds, createdAt, isInFlight, now]);

  return (
    <div className="min-w-0 w-full space-y-4">
      {/* Reconnecting banner */}
      {analysis.status === "reconnecting" && (
        <div className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/30 px-3 py-2.5">
          <RotateCcw className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">
            Connection dropped — attempting to reconnect.
          </p>
        </div>
      )}

      {/* In-flight: stages + cancel + (optionally) reconnect-for-live */}
      {(isInFlight || isLiveActive) && analysis.status !== "reconnecting" && (
        <div className="space-y-3">
          <InFlightAnalysisStages
            status={status}
            elapsedSeconds={elapsedSeconds}
            cells={cells}
            isLive={isLiveActive}
          />

          <div className="flex flex-wrap items-center gap-2">
            {/* Live cancel takes priority */}
            {isLiveActive && analysis.isCancellable && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => analysis.cancel()}
                className="text-muted-foreground h-7 px-2 text-xs"
              >
                Cancel
              </Button>
            )}
            {!isLiveActive && isInFlight && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
                className="text-muted-foreground h-7 px-2 text-xs"
              >
                Cancel
              </Button>
            )}
            {!isLiveActive && isInFlight && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => analysis.reconnectSession(sessionId)}
                className="text-muted-foreground gap-1.5 h-7 px-2 text-xs"
              >
                <Database className="h-3 w-3" />
                Watch live
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Failed — offer reconnect */}
      {status === "failed" && !isLiveActive && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {(resultData as { error?: string } | null)?.error ??
              "The analysis did not complete. Edison may have finished in the background — reconnect to retrieve the result."}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => analysis.reconnectSession(sessionId)}
            className="gap-2"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reconnect
          </Button>
        </div>
      )}

      {/* Live stream gave up after retries */}
      {analysis.status === "error" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {analysis.error ?? "Reconnection failed."}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => analysis.reconnectSession(sessionId)}
            className="gap-2"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Try again
          </Button>
        </div>
      )}

      {/* Cancelled */}
      {status === "cancelled" && !isLiveActive && (
        <p className="text-sm text-muted-foreground">Analysis was cancelled.</p>
      )}

      {/* Complete result (live or DB) */}
      {displayResult &&
        (status === "complete" || analysis.status === "complete") && (
          <ResultTabs result={displayResult} researchSessionId={sessionId} />
        )}

      {/* Edge: status complete in DB but no result payload */}
      {status === "complete" && !displayResult && (
        <p className="text-sm text-muted-foreground">
          No analysis result is stored for this session.
        </p>
      )}
    </div>
  );
}
