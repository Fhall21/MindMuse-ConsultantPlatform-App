"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import posthog from "posthog-js";
import { fetchJson } from "@/hooks/api";
import type { CanvasGraphHandle } from "@/components/canvas/canvas-graph";
import {
  computeSpatialLayout,
  type SpatialLayoutInput,
} from "@/lib/canvas-spatial-layout-core";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SpatialLayoutState = "idle" | "fetching" | "applying";

export interface UseSpatialLayoutArgs {
  roundId: string;
  graphRef: React.RefObject<CanvasGraphHandle | null>;
}

export interface UseSpatialLayout {
  state: SpatialLayoutState;
  /** scope "all" = whole canvas; "selected" = only the given top-level item ids. */
  runLayout: (opts?: {
    scope?: "all" | "selected";
    selectedItemIds?: string[];
  }) => Promise<void>;
  cancelLayout: () => Promise<void>;
}

interface JobStatusResponse {
  status: "idle" | "running" | "completed" | "failed";
  resultPositions?: Record<string, { x: number; y: number }>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Orchestration state machine for canvas spatial layout.
 *
 * State machine:
 *
 *   idle → fetching (runLayout POST or mount-check finds running job)
 *             │
 *             ├─ cancel → idle
 *             │
 *             ▼
 *          applying (d3-force runs locally)
 *             │
 *             ▼
 *           idle
 *
 * Job persistence: POST creates a DB job. Server fetch intentionally has NO
 * signal — it continues after client disconnects. On mount, GET checks for
 * in-progress jobs so the overlay survives page refreshes.
 *
 * Polling: active only when the mount-check path finds a running job.
 * pollingActiveRef stays false during the normal POST flow to prevent the
 * polling GET from racing with the POST response.
 *
 * Worker strategy: The project runs Vitest under a Node/jsdom environment
 * where `new Worker(new URL(...))` is not available. In production (browser),
 * computeSpatialLayout runs synchronously on the main thread. The computation
 * is fast (d3-force, ~100 ticks) so blocking is acceptable for v1.
 *
 * TODO(sprint-19): If the canvas grows large (>100 nodes) and main-thread
 * blocking becomes noticeable, migrate to the Web Worker pattern.
 */
export function useSpatialLayout({
  roundId,
  graphRef,
}: UseSpatialLayoutArgs): UseSpatialLayout {
  const [state, setState] = useState<SpatialLayoutState>("idle");

  const abortRef = useRef<AbortController | null>(null);

  // True only when mount-check found a running job. Prevents polling from
  // racing with the POST response in the normal runLayout flow.
  const pollingActiveRef = useRef(false);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  // ---------------------------------------------------------------------------
  // applyPositionsFromServer — shared by mount-check + polling paths
  // ---------------------------------------------------------------------------
  const applyPositionsFromServer = useCallback(
    (serverPositions: Record<string, { x: number; y: number }>) => {
      const graph = graphRef.current;
      if (!graph) {
        setState("idle");
        return;
      }

      const items = graph.getLayoutItems();
      const snapshot = graph.getTopLevelPositions();
      const snapshotValues = Object.values(snapshot);
      let bounds = { minX: -2000, minY: -2000, maxX: 2000, maxY: 2000 };
      if (snapshotValues.length > 0) {
        const xs = snapshotValues.map((p) => p.x);
        const ys = snapshotValues.map((p) => p.y);
        const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
        const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
        const range = 2000;
        bounds = {
          minX: cx - range,
          minY: cy - range,
          maxX: cx + range,
          maxY: cy + range,
        };
      }

      const input: SpatialLayoutInput = {
        nodes: items.map((i) => ({ id: i.id })),
        edges: [],
        serverPositions,
        bounds,
      };

      const result = computeSpatialLayout(input);
      if (result.type === "error") {
        graph.applyPositions(snapshot, { animate: false });
        toast.error("Layout failed — please try again.");
        setState("idle");
        return;
      }

      graph.applyPositions(result.positions, { animate: true });
      toast("Layout applied");
      setState("idle");
    },
    [graphRef]
  );

  // ---------------------------------------------------------------------------
  // Mount-check: detect in-progress job on mount (survives page refresh)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetchJson<JobStatusResponse>(
          `/api/client/consultations/${roundId}/canvas/spatial-layout`
        );
        if (cancelled || !mountedRef.current) return;

        if (response.status === "running") {
          pollingActiveRef.current = true;
          setState("fetching");
        } else if (response.status === "completed" && response.resultPositions) {
          setState("applying");
          applyPositionsFromServer(response.resultPositions);
        }
        // idle / failed → stay idle
      } catch {
        // non-fatal — mount-check failure just leaves state idle
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roundId, applyPositionsFromServer]);

  // ---------------------------------------------------------------------------
  // Polling: 2s interval — active only when pollingActiveRef is set
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (state !== "fetching" || !pollingActiveRef.current) return;

    const id = setInterval(() => {
      void (async () => {
        try {
          const response = await fetchJson<JobStatusResponse>(
            `/api/client/consultations/${roundId}/canvas/spatial-layout`
          );
          if (!mountedRef.current) return;

          if (response.status === "completed" && response.resultPositions) {
            clearInterval(id);
            pollingActiveRef.current = false;
            setState("applying");
            applyPositionsFromServer(response.resultPositions);
          } else if (response.status === "failed" || response.status === "idle") {
            clearInterval(id);
            pollingActiveRef.current = false;
            setState("idle");
            toast.error("Layout failed — please try again.");
          }
          // "running" → keep polling
        } catch {
          // ignore transient poll errors
        }
      })();
    }, 2000);

    return () => {
      clearInterval(id);
    };
  }, [state, roundId, applyPositionsFromServer]);

  // ---------------------------------------------------------------------------
  // cancelLayout
  // ---------------------------------------------------------------------------
  const cancelLayout = useCallback(async (): Promise<void> => {
    // D4: only call DELETE if fetching (server job running).
    // In "applying" state the job already completed in DB — no server job to cancel.
    if (state === "fetching") {
      abortRef.current?.abort();
      pollingActiveRef.current = false;
      try {
        await fetchJson(
          `/api/client/consultations/${roundId}/canvas/spatial-layout`,
          { method: "DELETE" }
        );
      } catch {
        // ignore — server may have already completed; stale job is harmless
      }
    }
    setState("idle");
  }, [state, roundId]);

  // ---------------------------------------------------------------------------
  // runLayout
  // ---------------------------------------------------------------------------
  const runLayout = useCallback(
    async (
      opts: { scope?: "all" | "selected"; selectedItemIds?: string[] } = {}
    ): Promise<void> => {
      const { scope = "all", selectedItemIds = [] } = opts;
      const graph = graphRef.current;

      // Guard: autosave race — don't reorganise while layout is being persisted.
      if (graph?.getLayoutSavePending()) {
        return;
      }

      if (!graph) return;

      let items = graph.getLayoutItems();

      if (scope === "selected" && selectedItemIds.length > 0) {
        const selectedSet = new Set(selectedItemIds);
        items = items.filter((item) => selectedSet.has(item.id));
      }

      if (items.length < 3) return;

      const snapshot = graph.getTopLevelPositions();

      const startTime = Date.now();
      posthog.capture("canvas_cluster_layout_triggered", {
        roundId,
        nodeCount: items.length,
      });

      // ── Fetching ───────────────────────────────────────────────────────────
      // pollingActiveRef stays false — POST drives state directly; no poll race.

      setState("fetching");

      const controller = new AbortController();
      abortRef.current = controller;

      let serverPositions: Record<string, { x: number; y: number }>;

      try {
        const response = await fetchJson<{
          positions: Record<string, { x: number; y: number }>;
        }>(
          `/api/client/consultations/${roundId}/canvas/spatial-layout`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              nodes: items.map((i) => ({ id: i.id, text: i.text })),
            }),
            signal: controller.signal,
          }
        );

        serverPositions = response.positions;
      } catch (err) {
        if (!mountedRef.current) return;

        const errorMessage =
          err instanceof Error ? err.message : "Layout request failed";

        posthog.capture("canvas_cluster_layout_failed", {
          roundId,
          error: errorMessage,
        });
        toast.error(
          "Layout failed — could not reach the layout service. Please try again."
        );
        setState("idle");
        return;
      }

      if (!mountedRef.current) return;

      // ── Applying (synchronous fallback — see module-level TODO) ───────────

      setState("applying");

      const snapshotValues = Object.values(snapshot);
      let bounds = { minX: -2000, minY: -2000, maxX: 2000, maxY: 2000 };
      if (snapshotValues.length > 0) {
        const xs = snapshotValues.map((p) => p.x);
        const ys = snapshotValues.map((p) => p.y);
        const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
        const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
        const range = 2000;
        bounds = {
          minX: cx - range,
          minY: cy - range,
          maxX: cx + range,
          maxY: cy + range,
        };
      }

      const input: SpatialLayoutInput = {
        nodes: items.map((i) => ({ id: i.id })),
        edges: [],
        serverPositions,
        bounds,
      };

      const result = computeSpatialLayout(input);

      if (!mountedRef.current) return;

      if (result.type === "error") {
        graph.applyPositions(snapshot, { animate: false });
        posthog.capture("canvas_cluster_layout_failed", {
          roundId,
          error: result.message,
        });
        toast.error("Layout failed — please try again.");
        setState("idle");
        return;
      }

      const finalPositions = result.positions;
      graph.applyPositions(finalPositions, { animate: true });

      const durationMs = Date.now() - startTime;
      posthog.capture("canvas_cluster_layout_completed", {
        roundId,
        durationMs,
      });

      // Undo toast — stays until user dismisses or interacts with the canvas.
      toast("Layout applied", {
        id: "layout-undo",
        action: {
          label: "Undo layout",
          onClick: () => {
            const g = graphRef.current;
            if (!g) return;
            const snapKeys = Object.keys(snapshot);
            if (snapKeys.length === 0) return;
            g.applyPositions(snapshot, { animate: true });
            posthog.capture("canvas_cluster_layout_undone", { roundId });
          },
        },
        duration: Infinity,
      });

      setState("idle");
    },
    [roundId, graphRef]
  );

  return { state, runLayout, cancelLayout };
}
