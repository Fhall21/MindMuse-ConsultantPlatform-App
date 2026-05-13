import { useCallback, useRef, useState } from "react";
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

export interface LiteratureReference {
  number: number;
  citation_key: string;
  title: string;
  authors: string;
  year: string;
  journal: string;
  url: string;
}

export interface ReasoningStep {
  label: string;
  detail: string;
  content?: string;
}

export interface EvidenceExcerpt {
  id: string;
  excerpt: string;
  question: string;
  score: number;
}

export interface LiteratureResult {
  answer: string;
  reasoning_steps: ReasoningStep[];
  references: LiteratureReference[];
  evidence: EvidenceExcerpt[];
  artifact: string;
}

export type LiteratureStatus = "idle" | "submitted" | "polling" | "complete" | "error" | "cancelled";

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

    // 1. Create session row
    let sessionId: string | null = null;
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

    // 2. Open SSE stream
    let response: Response;
    try {
      response = await fetch("/api/research/literature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, industry_ctx: industryCtx ?? null }),
        signal: controller.signal,
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setState((s) => ({ ...s, status: "error", error: "Connection to research service failed" }));
      return;
    }

    if (!response.ok || !response.body) {
      setState((s) => ({
        ...s,
        status: "error",
        error: `Research service returned ${response.status}`,
      }));
      return;
    }

    // 3. Read SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const patchSession = (updates: Record<string, unknown>) => {
      if (!sessionId) return;
      fetchJson(`/api/research/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      }).catch(() => {});
    };

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
              reasoningSteps: incomingSteps && incomingSteps.length > s.reasoningSteps.length
                ? incomingSteps
                : s.reasoningSteps,
            }));
            // Persist partial steps so /research/[id] detail page sees live
            // chain-of-thought via its 4s DB poll
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
            patchSession({ status: "complete", result_data: event.data });
            return;
          } else if (event.type === "error") {
            const msg = (event.data.message as string) || "Research failed";
            setState((s) => ({ ...s, status: "error", error: msg }));
            patchSession({ status: "failed" });
            return;
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setState((s) => ({ ...s, status: "error", error: "Stream interrupted" }));
        patchSession({ status: "failed" });
      }
    } finally {
      reader.releaseLock();
    }
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    // Patch session to cancelled in the background; sessionId captured via closure
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

  const isCancellable = state.status === "submitted" || state.status === "polling";

  return { ...state, submit, reset, cancel, isCancellable };
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

export interface ResearchSessionDetail extends ResearchSessionSummary {
  resultData: LiteratureResult | null;
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
