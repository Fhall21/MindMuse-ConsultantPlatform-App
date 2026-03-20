"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "@/hooks/api";
import type {
  CanvasEdge,
  CanvasNode,
  CanvasViewport,
  ConnectionType,
} from "@/types/canvas";

// ---------------------------------------------------------------------------
// Response shape from GET /api/client/consultations/[id]/canvas
// ---------------------------------------------------------------------------

export interface CanvasData {
  consultation_id: string;
  round_id: string;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  viewport: CanvasViewport;
}

// ---------------------------------------------------------------------------
// Mutation payloads
// ---------------------------------------------------------------------------

export interface CreateEdgePayload {
  source_node_id: string;
  target_node_id: string;
  connection_type: ConnectionType;
  note?: string | null;
}

export interface UpdateEdgePayload {
  id: string;
  connection_type?: ConnectionType;
  note?: string | null;
}

export interface SaveLayoutPayload {
  positions: Record<string, { x: number; y: number }>;
  viewport: CanvasViewport;
}

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

function canvasKey(consultationId: string) {
  return ["canvas", consultationId] as const;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useCanvas(consultationId: string) {
  return useQuery<CanvasData>({
    queryKey: canvasKey(consultationId),
    queryFn: () =>
      fetchJson<CanvasData>(
        `/api/client/consultations/${consultationId}/canvas`
      ),
    enabled: Boolean(consultationId),
  });
}

export function useCreateEdge(consultationId: string) {
  const queryClient = useQueryClient();
  return useMutation<CanvasEdge, Error, CreateEdgePayload>({
    mutationFn: (payload) =>
      fetchJson<CanvasEdge>(
        `/api/client/consultations/${consultationId}/canvas/edges`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: canvasKey(consultationId) });
    },
  });
}

export function useUpdateEdge(consultationId: string) {
  const queryClient = useQueryClient();
  return useMutation<CanvasEdge, Error, UpdateEdgePayload>({
    mutationFn: ({ id, ...payload }) =>
      fetchJson<CanvasEdge>(
        `/api/client/consultations/${consultationId}/canvas/edges/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: canvasKey(consultationId) });
    },
  });
}

export function useDeleteEdge(consultationId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (edgeId) =>
      fetchJson<void>(
        `/api/client/consultations/${consultationId}/canvas/edges/${edgeId}`,
        { method: "DELETE" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: canvasKey(consultationId) });
    },
  });
}

export function useSaveLayout(consultationId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, SaveLayoutPayload>({
    mutationFn: (payload) =>
      fetchJson<void>(
        `/api/client/consultations/${consultationId}/canvas/layout`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: canvasKey(consultationId) });
    },
  });
}
