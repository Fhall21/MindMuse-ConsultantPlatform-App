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
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Orchestration state machine for canvas spatial layout.
 *
 * Worker strategy: The project runs Vitest under a Node/jsdom environment
 * where `new Worker(new URL(...))` is not available (no native Worker global).
 * In production (browser), Next.js 16 supports the `new URL(...)` worker
 * bundling pattern. However, to keep the hook testable without Worker mocking
 * and to avoid bundler-specific configuration concerns with the current setup,
 * this hook uses the SYNCHRONOUS fallback: calling `computeSpatialLayout`
 * directly on the main thread. The computation is fast (d3-force, ~100 ticks)
 * so blocking for a few hundred milliseconds is acceptable for v1.
 *
 * TODO(sprint-19): If the canvas grows large (>100 nodes) and main-thread
 * blocking becomes noticeable, migrate to the Web Worker pattern:
 *   const worker = new Worker(
 *     new URL("@/workers/canvas-spatial-layout.worker.ts", import.meta.url)
 *   );
 * and handle worker.onmessage / worker.onerror / a 10s timeout + cleanup.
 */
export function useSpatialLayout({
  roundId,
  graphRef,
}: UseSpatialLayoutArgs): UseSpatialLayout {
  const [state, setState] = useState<SpatialLayoutState>("idle");

  // Keep a ref to any in-flight abort controller so unmount can clean up.
  const abortRef = useRef<AbortController | null>(null);

  // Track whether the hook is still mounted.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Abort any in-flight fetch on unmount.
      abortRef.current?.abort();
    };
  }, []);

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

      // Build candidate items.
      let items = graph.getLayoutItems();

      // For "selected" scope, intersect with the top-level ids that were
      // returned by getLayoutItems (which already folds grouped children into
      // their parent group item).  Any selected id that doesn't match a
      // top-level item id (e.g. a grouped child) is simply not matched —
      // that's the intended behaviour per the spec.
      if (scope === "selected" && selectedItemIds.length > 0) {
        const selectedSet = new Set(selectedItemIds);
        items = items.filter((item) => selectedSet.has(item.id));
      }

      // Minimum node guard (button should already be disabled, but guard anyway).
      if (items.length < 3) return;

      // Snapshot positions before any changes so we can restore on failure/undo.
      const snapshot = graph.getTopLevelPositions();

      const startTime = Date.now();
      posthog.capture("canvas_cluster_layout_triggered", {
        roundId,
        nodeCount: items.length,
      });

      // ── Fetching ───────────────────────────────────────────────────────────

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

      // Derive bounds from the snapshot extents so the layout stays roughly
      // within the visible area the user was already working in.
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

      // Apply the computed positions with animation.
      const finalPositions = result.positions;
      graph.applyPositions(finalPositions, { animate: true });

      const durationMs = Date.now() - startTime;
      posthog.capture("canvas_cluster_layout_completed", {
        roundId,
        durationMs,
      });

      // Undo toast — capture snapshot in closure so the action always restores
      // the pre-layout state regardless of any subsequent changes.
      toast("Layout applied", {
        action: {
          label: "Undo layout",
          onClick: () => {
            graphRef.current?.applyPositions(snapshot, { animate: true });
            posthog.capture("canvas_cluster_layout_undone", { roundId });
          },
        },
        duration: 5000,
      });

      setState("idle");
    },
    [roundId, graphRef]
  );

  return { state, runLayout };
}
