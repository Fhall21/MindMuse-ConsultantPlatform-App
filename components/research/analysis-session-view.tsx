"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { AnswerText } from "./answer-text";
import { NotebookCells } from "./notebook-cells";

interface AnalysisSessionViewProps {
  sessionId: string;
  status: "pending" | "running" | "complete" | "failed" | "cancelled";
  resultData: AnalysisResult | null;
  query: string;
}

/** Minimal artifact list for the detail page (no inline previews to keep it light). */
function ArtifactRows({ artifacts }: { artifacts: AnalysisArtifact[] }) {
  if (!artifacts || artifacts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No artifacts produced.</p>
    );
  }
  return (
    <ul className="space-y-2">
      {artifacts.map((art, idx) => (
        <li
          key={`${art.entry_id}-${idx}`}
          className="rounded-lg border bg-card p-3"
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{art.filename}</p>
              <p className="text-xs text-muted-foreground">
                {art.mime_type}
                {art.size_bytes != null &&
                  ` · ${(art.size_bytes / 1024).toFixed(1)} KB`}
              </p>
            </div>
            <a
              href={`/api/research/analysis/artifacts/${encodeURIComponent(
                art.entry_id
              )}`}
              download={art.filename}
              className="inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium hover:bg-muted"
            >
              Download
            </a>
          </div>
        </li>
      ))}
    </ul>
  );
}

interface ResultTabsProps {
  result: AnalysisResult;
}

function ResultTabs({ result }: ResultTabsProps) {
  const [activeTab, setActiveTab] = useState<"summary" | "notebook" | "artifacts">(
    "summary"
  );
  const cells = result.notebook_cells ?? [];
  const artifacts = result.artifacts ?? [];

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => setActiveTab(v as typeof activeTab)}
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

      <TabsContent value="summary" className="mt-3">
        <ScrollArea className="max-h-[600px] rounded-lg border bg-card p-4">
          <AnswerText text={result.answer || "_No summary returned._"} />
        </ScrollArea>
      </TabsContent>

      <TabsContent value="notebook" className="mt-3">
        <ScrollArea className="max-h-[700px] rounded-lg border bg-card p-3">
          <NotebookCells cells={cells} variant="detail" />
        </ScrollArea>
      </TabsContent>

      <TabsContent value="artifacts" className="mt-3">
        <ScrollArea className="max-h-[600px]">
          <ArtifactRows artifacts={artifacts} />
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );
}

export function AnalysisSessionView({
  sessionId,
  status,
  resultData,
}: AnalysisSessionViewProps) {
  const qc = useQueryClient();
  const analysis = useDataAnalysis();

  // Refresh DB-backed query once the live SSE wraps up.
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

  // Live result wins when the stream just completed; else fall back to DB.
  const displayResult: AnalysisResult | null =
    analysis.status === "complete" && analysis.result
      ? analysis.result
      : resultData;

  // Live cells while polling; partial cells from DB if no live stream.
  const partialCells: AnalysisNotebookCell[] =
    analysis.notebookCells.length > 0
      ? analysis.notebookCells
      : ((resultData as { partial_notebook_cells?: AnalysisNotebookCell[] } | null)
          ?.partial_notebook_cells ?? []);

  return (
    <div className="space-y-4">
      {/* Live reconnecting banner */}
      {analysis.status === "reconnecting" && (
        <div className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/30 px-3 py-2.5">
          <RotateCcw className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">
            Connection dropped — attempting to reconnect.
          </p>
        </div>
      )}

      {/* In-flight (live OR DB) */}
      {(isLiveActive || isInFlight) && analysis.status !== "reconnecting" && (
        <div className="flex items-center gap-3 rounded-xl border bg-muted/30 px-4 py-3">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
          <div className="flex-1 text-sm text-muted-foreground">
            {isLiveActive
              ? analysis.pollingMessage ||
                "Edison is running the notebook — usually 2–5 minutes."
              : "Analysis is in progress. Refresh the page in a few minutes — Edison typically returns in 2–5 minutes."}
          </div>
          {analysis.elapsedSeconds > 0 && (
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {Math.floor(analysis.elapsedSeconds / 60)}:
              {String(analysis.elapsedSeconds % 60).padStart(2, "0")}
            </span>
          )}
        </div>
      )}

      {/* In-flight notebook cells (live or DB partial) */}
      {(isLiveActive || isInFlight) && partialCells.length > 0 && (
        <div className="rounded-lg border bg-card p-3">
          <ScrollArea className="max-h-[420px]">
            <NotebookCells
              cells={partialCells}
              isLive={isLiveActive}
              variant="panel"
            />
          </ScrollArea>
        </div>
      )}

      {/* Cancel buttons — live takes priority. */}
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
      {isInFlight && !isLiveActive && (
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

      {/* Live error (reconnect attempts exhausted) */}
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
          <ResultTabs result={displayResult} />
        )}

      {/* DB has no result yet, in-flight already shown above; nothing more to render. */}
      {!displayResult &&
        !isLiveActive &&
        !isInFlight &&
        status !== "failed" &&
        status !== "cancelled" && (
          <p className="text-sm text-muted-foreground">
            No analysis result is stored for this session.
          </p>
        )}
    </div>
  );
}
