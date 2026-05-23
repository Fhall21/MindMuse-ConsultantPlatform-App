import React, { useCallback, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson, readErrorMessage } from "@/hooks/api";

export type ResearchSessionType = "literature" | "analysis";

export interface ResearchRequest {
  query: string;
}

export function useStartResearchStream(sessionType: ResearchSessionType) {
  return useMutation({
    mutationFn: async (payload: ResearchRequest) => {
      const response = await fetch(`/api/research/${sessionType}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      return response;
    },
  });
}

// ── Literature research hook ──────────────────────────────────────────────────

export type ReferenceStrength = "DOMAIN_LEADING" | "PEER_REVIEWED" | "HIGHEST_QUALITY";
export type PaperType = "journal" | "preprint" | "clinical_trial" | "other";

export interface LiteratureReference {
  number: number;
  citation_key: string;
  title: string;
  authors: string;
  year: string;
  journal: string;
  url: string;
  citation_count?: number;
  strength?: ReferenceStrength;
  paper_type?: PaperType;
  contexts_used?: string[];
  contexts_unused?: string[];
}

// Stats shown at the top of the Evidence tab. Mirrors Edison's
// `response.answer.analysis_status` when present; otherwise derived in the
// backend from contexts + references. See plan D1 for zero-handling.
export interface LiteratureStats {
  paper_count: number;
  relevant_papers: number;
  clinical_trial_count: number;
  relevant_clinical_trials: number;
  current_evidence: number;
  disease_target_evidence: number;
}

// Discriminated-union payloads attached to each reasoning step. `kind`
// is the source of truth — see plan "Internal DX guardrails."
export interface PlanStepData {
  kind: "plan";
  rows: Array<{
    id: number;
    objective: string;
    rationale: string;
    status: "COMPLETED" | "IN-PROGRESS" | "PENDING";
    result: string;
    evaluation: string;
  }>;
}

export interface SearchPaper {
  title: string;
  citation_key?: string;
  authors?: string;
  year?: string;
  journal?: string;
  doi?: string;
  url?: string;
  chunk_count?: number;
}

export interface SearchStepData {
  kind: "search";
  queries: Array<{ query: string; papers: SearchPaper[]; count: number }>;
}

export interface GatherExcerpt {
  id?: string;
  excerpt: string;
  source_citation_key?: string;
  source_ref_number?: number;
  source_title?: string;
  citation_count?: number;
}

export interface GatherRound {
  question: string;
  focus_papers?: string[];
  excerpts_count: number;
  top_excerpts: GatherExcerpt[];
}

export interface GatherStepData {
  kind: "gather";
  // Back-compat shorthand for the first round; UIs that don't read `rounds`
  // still get something to show.
  question: string;
  excerpts_count: number;
  top_excerpts: GatherExcerpt[];
  rounds?: GatherRound[];
}

export interface FigureRound {
  citation_key: string;
  image_count: number;
  query: string;
  description: string;
  text_name?: string;
  images?: Array<{ url: string }>;
}

export interface LiteratureFigure {
  id: string;
  url: string;
  citation_key: string;
  query?: string;
  text_name?: string;
  description?: string;
  round_index?: number;
}

export interface FiguresStepData {
  kind: "figures";
  rounds: FigureRound[];
}

export interface ReadStepData {
  kind: "read";
  papers: Array<{ citation_key: string; title: string; takeaway: string }>;
}

export interface ArtifactStepData {
  kind: "artifact";
  table_markdown: string;
  stats?: LiteratureStats;
}

export type ReasoningStepData =
  | PlanStepData
  | SearchStepData
  | GatherStepData
  | FiguresStepData
  | ReadStepData
  | ArtifactStepData;

export interface ReasoningStep {
  label: string;
  detail: string;
  content?: string;
  data?: ReasoningStepData;
}

export interface EvidenceExcerpt {
  id: string;
  excerpt: string;
  question: string;
  score: number;
  source_ref_number?: number;
  source_title?: string;
  source_url?: string;
}

export interface LiteratureResult {
  answer: string;
  reasoning_steps: ReasoningStep[];
  references: LiteratureReference[];
  evidence: EvidenceExcerpt[];
  artifact: string;
  stats?: LiteratureStats;
  figures?: LiteratureFigure[];
}

export type LiteratureStatus = "idle" | "submitted" | "polling" | "complete" | "error" | "cancelled" | "reconnecting";

interface LiteratureState {
  status: LiteratureStatus;
  result: LiteratureResult | null;
  error: string | null;
  elapsedSeconds: number;
  pollingMessage: string;
  reasoningSteps: ReasoningStep[];
  sessionId: string | null;
}

const INITIAL_STATE: LiteratureState = {
  status: "idle",
  result: null,
  error: null,
  elapsedSeconds: 0,
  pollingMessage: "",
  reasoningSteps: [],
  sessionId: null,
};

// ── SSE stream runner (shared between submit and reconnectSession) ────────────

type SetState = React.Dispatch<React.SetStateAction<LiteratureState>>;

async function _runSseStream(
  sessionId: string,
  query: string,
  industryCtx: string | null | undefined,
  controller: AbortController,
  setState: SetState,
  lastPatchedStepCountRef: React.MutableRefObject<number>,
): Promise<void> {
  const patchSession = (updates: Record<string, unknown>, terminal = false) => {
    fetchJson(`/api/research/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    }).catch((err) => {
      if (terminal) console.error("[research] failed to persist session update:", err);
    });
  };

  // Hoisted function declarations so reconnect/openStream can forward-reference.
  async function reconnect(attempt: number, reason: string): Promise<void> {
    const MAX_ATTEMPTS = 3;
    const backoffMs = [2000, 4000, 8000] as const;
    if (controller.signal.aborted) return;
    if (attempt >= MAX_ATTEMPTS) {
      setState((s) => ({
        ...s,
        status: "error",
        error: "Connection lost — check Research History for your result",
      }));
      return;
    }
    setState((s) => ({ ...s, status: "reconnecting" }));
    console.warn(`[research] ${reason}, reconnecting (attempt ${attempt + 1}/${MAX_ATTEMPTS})`);
    await new Promise<void>((res) => setTimeout(res, backoffMs[attempt] ?? 8000));
    if (controller.signal.aborted) return;
    return openStream(attempt + 1);
  }

  async function openStream(attempt: number): Promise<void> {
    let response: Response;
    try {
      response = await fetch("/api/research/literature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, query, industry_ctx: industryCtx ?? null }),
        signal: controller.signal,
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      return reconnect(attempt, "Connection failed");
    }

    if (!response.ok || !response.body) {
      setState((s) => ({
        ...s,
        status: "error",
        error: `Research service returned ${response.status}`,
      }));
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          let event: { type: string; data: Record<string, unknown> };
          try {
            event = JSON.parse(raw) as typeof event;
          } catch {
            continue;
          }

          if (event.type === "submitted") {
            setState((s) => ({ ...s, status: "submitted" }));
          } else if (event.type === "polling") {
            const incomingSteps = event.data.reasoning_steps as ReasoningStep[] | undefined;
            setState((s) => ({
              ...s,
              status: "polling",
              elapsedSeconds: (event.data.elapsed_seconds as number) ?? s.elapsedSeconds,
              pollingMessage: (event.data.message as string) || s.pollingMessage,
              reasoningSteps:
                incomingSteps && incomingSteps.length > s.reasoningSteps.length
                  ? incomingSteps
                  : s.reasoningSteps,
            }));
            if (incomingSteps && incomingSteps.length > lastPatchedStepCountRef.current) {
              lastPatchedStepCountRef.current = incomingSteps.length;
              patchSession({ result_data: { partial_reasoning_steps: incomingSteps } });
            }
          } else if (event.type === "complete") {
            const data = event.data as unknown as LiteratureResult;
            setState((s) => ({
              ...s,
              status: "complete",
              result: data,
              reasoningSteps: data.reasoning_steps ?? s.reasoningSteps,
            }));
            patchSession({ status: "complete", result_data: event.data }, true);
            return;
          } else if (event.type === "error") {
            const msg = (event.data.message as string) || "Research failed";
            setState((s) => ({ ...s, status: "error", error: msg }));
            patchSession({ status: "failed" }, true);
            return;
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      return reconnect(attempt, "Stream interrupted");
    } finally {
      reader.releaseLock();
    }
  }

  await openStream(0);
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useLiteratureResearch() {
  const [state, setState] = useState<LiteratureState>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);
  const lastPatchedStepCountRef = useRef(0);

  const submit = useCallback(async (query: string, industryCtx?: string) => {
    abortRef.current?.abort();
    lastPatchedStepCountRef.current = 0;
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ ...INITIAL_STATE, status: "submitted" });

    // 1. Create session row — worker picks this up and submits to Edison.
    let sessionId: string;
    try {
      const sessionRes = await fetchJson<{ id: string }>("/api/research/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, session_type: "literature", industry_ctx: industryCtx ?? null }),
        signal: controller.signal,
      });
      sessionId = sessionRes.id;
      setState((s) => ({ ...s, sessionId }));
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setState((s) => ({ ...s, status: "error", error: "Failed to create research session" }));
      return;
    }

    // 2. Open SSE stream with the new session_id.
    await _runSseStream(sessionId, query, industryCtx, controller, setState, lastPatchedStepCountRef);
  }, []);

  // Re-connect to an existing session's Edison task without creating a new session.
  // Used by the detail page to recover failed sessions or reconnect dropped streams.
  const reconnectSession = useCallback(async (existingSessionId: string, query: string, industryCtx?: string) => {
    abortRef.current?.abort();
    lastPatchedStepCountRef.current = 0;
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ ...INITIAL_STATE, status: "submitted", sessionId: existingSessionId });

    await _runSseStream(existingSessionId, query, industryCtx, controller, setState, lastPatchedStepCountRef);
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setState((s) => {
      if (s.sessionId) {
        fetchJson(`/api/research/sessions/${s.sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "cancelled" }),
        }).catch(() => {});
      }
      return INITIAL_STATE;
    });
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState(INITIAL_STATE);
  }, []);

  const isCancellable = state.status === "submitted" || state.status === "polling" || state.status === "reconnecting";

  return { ...state, submit, reconnectSession, reset, cancel, isCancellable };
}

// ── Data analysis hook ────────────────────────────────────────────────────────

export interface AnalysisCellOutput {
  output_type: "stream" | "execute_result" | "display_data" | "error";
  name?: string;
  text?: string;
  data?: {
    "text/plain"?: string;
    "text/html"?: string;
    "image/png"?: string;
    "image/jpeg"?: string;
  };
  ename?: string;
  evalue?: string;
  traceback?: string;
}

export interface AnalysisNotebookCell {
  index: number;
  execution_count: number | null;
  display_text: string;
  code: string;
  outputs: AnalysisCellOutput[];
  status: "ok" | "error";
}

export interface AnalysisArtifact {
  entry_id: string;
  filename: string;
  mime_type: string;
  size_bytes?: number;
  inline_data_url?: string;
  inline_text?: string;
  error?: string;
}

export interface AnalysisStats {
  cell_count: number;
  error_cell_count: number;
  artifact_count: number;
}

export interface AnalysisResult {
  answer: string;
  notebook_cells: AnalysisNotebookCell[];
  artifacts: AnalysisArtifact[];
  output_data?: Array<{ entry_id: string; filename: string }>;
  stats?: AnalysisStats;
  warnings?: string[];
  stub?: boolean;
}

export type AnalysisStatus =
  | "idle"
  | "uploading"
  | "submitted"
  | "polling"
  | "complete"
  | "error"
  | "cancelled"
  | "reconnecting";

export interface AnalysisUploadResult {
  file_entry_id: string;
  filename_count: number;
  total_bytes: number;
}

interface AnalysisState {
  status: AnalysisStatus;
  result: AnalysisResult | null;
  error: string | null;
  elapsedSeconds: number;
  pollingMessage: string;
  notebookCells: AnalysisNotebookCell[];
  sessionId: string | null;
  fileEntryId: string | null;
}

const INITIAL_ANALYSIS_STATE: AnalysisState = {
  status: "idle",
  result: null,
  error: null,
  elapsedSeconds: 0,
  pollingMessage: "",
  notebookCells: [],
  sessionId: null,
  fileEntryId: null,
};

type SetAnalysisState = React.Dispatch<React.SetStateAction<AnalysisState>>;

async function _runAnalysisSseStream(
  sessionId: string,
  controller: AbortController,
  setState: SetAnalysisState,
  lastPatchedCellCountRef: React.MutableRefObject<number>
): Promise<void> {
  const patchSession = (updates: Record<string, unknown>, terminal = false) => {
    fetchJson(`/api/research/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    }).catch((err) => {
      if (terminal) console.error("[analysis] failed to persist session update:", err);
    });
  };

  // Hoisted function declarations so reconnect/openStream can forward-reference.
  async function reconnect(attempt: number, reason: string): Promise<void> {
    const MAX_ATTEMPTS = 3;
    const backoffMs = [2000, 4000, 8000] as const;
    if (controller.signal.aborted) return;
    if (attempt >= MAX_ATTEMPTS) {
      setState((s) => ({
        ...s,
        status: "error",
        error: "Connection lost — check Research History for your result",
      }));
      return;
    }
    setState((s) => ({ ...s, status: "reconnecting" }));
    console.warn(`[analysis] ${reason}, reconnecting (attempt ${attempt + 1}/${MAX_ATTEMPTS})`);
    await new Promise<void>((res) => setTimeout(res, backoffMs[attempt] ?? 8000));
    if (controller.signal.aborted) return;
    return openStream(attempt + 1);
  }

  async function openStream(attempt: number): Promise<void> {
    let response: Response;
    try {
      response = await fetch("/api/research/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
        signal: controller.signal,
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      return reconnect(attempt, "Connection failed");
    }

    if (!response.ok || !response.body) {
      setState((s) => ({
        ...s,
        status: "error",
        error: `Analysis service returned ${response.status}`,
      }));
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          let event: { type: string; data: Record<string, unknown> };
          try {
            event = JSON.parse(raw) as typeof event;
          } catch {
            continue;
          }

          if (event.type === "submitted") {
            setState((s) => ({ ...s, status: "submitted" }));
          } else if (event.type === "polling") {
            const incomingCells = event.data.notebook_cells as
              | AnalysisNotebookCell[]
              | undefined;
            setState((s) => ({
              ...s,
              status: "polling",
              elapsedSeconds: (event.data.elapsed_seconds as number) ?? s.elapsedSeconds,
              pollingMessage: (event.data.message as string) || s.pollingMessage,
              notebookCells:
                incomingCells && incomingCells.length > s.notebookCells.length
                  ? incomingCells
                  : s.notebookCells,
            }));
            // Persist partial cells so the detail page can render progress on reload.
            if (incomingCells && incomingCells.length > lastPatchedCellCountRef.current) {
              lastPatchedCellCountRef.current = incomingCells.length;
              patchSession({ result_data: { partial_notebook_cells: incomingCells } });
            }
          } else if (event.type === "complete") {
            const data = event.data as unknown as AnalysisResult;
            setState((s) => ({
              ...s,
              status: "complete",
              result: data,
              notebookCells: data.notebook_cells ?? s.notebookCells,
            }));
            patchSession({ status: "complete", result_data: event.data }, true);
            return;
          } else if (event.type === "error") {
            const msg = (event.data.message as string) || "Analysis failed";
            setState((s) => ({ ...s, status: "error", error: msg }));
            patchSession({ status: "failed" }, true);
            return;
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      return reconnect(attempt, "Stream interrupted");
    } finally {
      reader.releaseLock();
    }
  }

  await openStream(0);
}

export function useDataAnalysis() {
  const [state, setState] = useState<AnalysisState>(INITIAL_ANALYSIS_STATE);
  const abortRef = useRef<AbortController | null>(null);
  const lastPatchedCellCountRef = useRef(0);

  const submit = useCallback(
    async (params: { query: string; files: File[]; industryCtx?: string | null }) => {
      const { query, files, industryCtx } = params;
      abortRef.current?.abort();
      lastPatchedCellCountRef.current = 0;
      const controller = new AbortController();
      abortRef.current = controller;

      setState({ ...INITIAL_ANALYSIS_STATE, status: "uploading" });

      // 1. Upload CSVs to Edison via the FastAPI proxy.
      let fileEntryId: string;
      try {
        const formData = new FormData();
        for (const file of files) {
          formData.append("files", file, file.name);
        }
        formData.append("name", `ConsultantPlatform analysis: ${query.slice(0, 80)}`);

        const uploadResp = await fetch("/api/research/analysis/upload", {
          method: "POST",
          body: formData,
          signal: controller.signal,
        });
        if (!uploadResp.ok) {
          throw new Error(await readErrorMessage(uploadResp));
        }
        const uploadJson = (await uploadResp.json()) as AnalysisUploadResult;
        fileEntryId = uploadJson.file_entry_id;
        setState((s) => ({ ...s, fileEntryId }));
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setState((s) => ({
          ...s,
          status: "error",
          error: (err as Error).message || "Failed to upload files",
        }));
        return;
      }

      // 2. Create session row — worker picks up and submits to Edison.
      let sessionId: string;
      try {
        const sessionRes = await fetchJson<{ id: string }>("/api/research/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query,
            session_type: "analysis",
            industry_ctx: industryCtx ?? null,
            file_entry_id: fileEntryId,
          }),
          signal: controller.signal,
        });
        sessionId = sessionRes.id;
        setState((s) => ({ ...s, sessionId, status: "submitted" }));
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setState((s) => ({ ...s, status: "error", error: "Failed to create analysis session" }));
        return;
      }

      // 3. Open SSE stream.
      await _runAnalysisSseStream(sessionId, controller, setState, lastPatchedCellCountRef);
    },
    []
  );

  // Re-connect to an existing session's Edison task without creating a new one.
  // Used by the detail page to recover failed sessions or reconnect dropped streams.
  const reconnectSession = useCallback(async (existingSessionId: string) => {
    abortRef.current?.abort();
    lastPatchedCellCountRef.current = 0;
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ ...INITIAL_ANALYSIS_STATE, status: "submitted", sessionId: existingSessionId });

    await _runAnalysisSseStream(existingSessionId, controller, setState, lastPatchedCellCountRef);
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setState((s) => {
      if (s.sessionId) {
        fetchJson(`/api/research/sessions/${s.sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "cancelled" }),
        }).catch(() => {});
      }
      return INITIAL_ANALYSIS_STATE;
    });
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState(INITIAL_ANALYSIS_STATE);
  }, []);

  const isCancellable =
    state.status === "uploading" ||
    state.status === "submitted" ||
    state.status === "polling" ||
    state.status === "reconnecting";

  return { ...state, submit, reconnectSession, cancel, reset, isCancellable };
}

// ── Session list / detail hooks ───────────────────────────────────────────────

export interface ResearchSessionSummary {
  id: string;
  sessionType: "literature" | "analysis";
  query: string;
  status: "pending" | "running" | "complete" | "failed" | "cancelled";
  createdAt: string;
  completedAt: string | null;
}

// Heterogeneous: literature sessions store LiteratureResult, analysis sessions
// store AnalysisResult. Consumers cast based on sessionType.
export type ResearchSessionResultData =
  | LiteratureResult
  | AnalysisResult
  | (Record<string, unknown> & { error?: string })
  | null;

export interface ResearchSessionDetail extends ResearchSessionSummary {
  resultData: ResearchSessionResultData;
}

const IN_FLIGHT_STATUSES = new Set(["pending", "running"]);

export function useResearchSessions() {
  return useQuery({
    queryKey: ["research-sessions"],
    queryFn: () => fetchJson<{ sessions: ResearchSessionSummary[] }>("/api/research/sessions"),
    select: (data) => data.sessions,
    staleTime: 10_000,
  });
}

export function useResearchSession(id: string) {
  return useQuery({
    queryKey: ["research-session", id],
    queryFn: () => fetchJson<{ session: ResearchSessionDetail }>(`/api/research/sessions/${id}`),
    select: (data) => data.session,
    // Poll while in-flight; stop once complete or failed
    refetchInterval: (query) => {
      const status = query.state.data?.session?.status;
      return status && IN_FLIGHT_STATUSES.has(status) ? 4_000 : false;
    },
  });
}

export function useCreateResearchSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { query: string; session_type?: string; industry_ctx?: string | null }) =>
      fetchJson<{ id: string }>("/api/research/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["research-sessions"] });
    },
  });
}
