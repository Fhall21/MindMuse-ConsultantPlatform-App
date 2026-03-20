"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "@/hooks/api";
import type {
  AiConnectionSuggestion,
  CanvasEdge,
  CanvasLayoutPosition,
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
  source_node_type: CanvasNode["type"];
  source_node_id: string;
  target_node_type: CanvasNode["type"];
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
  positions: Record<string, CanvasLayoutPosition>;
  viewport: CanvasViewport;
}

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

function canvasKey(consultationId: string) {
  return ["canvas", consultationId] as const;
}

function updateCanvasCache(
  queryClient: ReturnType<typeof useQueryClient>,
  consultationId: string,
  updater: (current: CanvasData) => CanvasData
) {
  queryClient.setQueryData<CanvasData>(canvasKey(consultationId), (current) =>
    current ? updater(current) : current
  );
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
    onSuccess: (createdEdge) => {
      updateCanvasCache(queryClient, consultationId, (current) => ({
        ...current,
        edges: [
          createdEdge,
          ...current.edges.filter((edge) => edge.id !== createdEdge.id),
        ],
      }));
    },
  });
}

export function useUpdateEdge(consultationId: string) {
  const queryClient = useQueryClient();
  return useMutation<CanvasEdge, Error, UpdateEdgePayload, { previous?: CanvasData }>({
    mutationFn: ({ id, ...payload }) =>
      fetchJson<CanvasEdge>(
        `/api/client/consultations/${consultationId}/canvas/edges/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      ),
    onMutate: async ({ id, ...updates }) => {
      const previous = queryClient.getQueryData<CanvasData>(canvasKey(consultationId));
      updateCanvasCache(queryClient, consultationId, (current) => ({
        ...current,
        edges: current.edges.map((edge) =>
          edge.id === id
            ? {
                ...edge,
                connection_type: updates.connection_type ?? edge.connection_type,
                note:
                  updates.note === undefined ? edge.note : updates.note,
              }
            : edge
        ),
      }));
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(canvasKey(consultationId), context.previous);
      }
    },
    onSuccess: (updatedEdge) => {
      updateCanvasCache(queryClient, consultationId, (current) => ({
        ...current,
        edges: current.edges.map((edge) =>
          edge.id === updatedEdge.id ? updatedEdge : edge
        ),
      }));
    },
  });
}

export function useDeleteEdge(consultationId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string, { previous?: CanvasData }>({
    mutationFn: (edgeId) =>
      fetchJson<void>(
        `/api/client/consultations/${consultationId}/canvas/edges/${edgeId}`,
        { method: "DELETE" }
      ),
    onMutate: async (edgeId) => {
      const previous = queryClient.getQueryData<CanvasData>(canvasKey(consultationId));
      updateCanvasCache(queryClient, consultationId, (current) => ({
        ...current,
        edges: current.edges.filter((edge) => edge.id !== edgeId),
      }));
      return { previous };
    },
    onError: (_error, _edgeId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(canvasKey(consultationId), context.previous);
      }
    },
  });
}

export function useSaveLayout(consultationId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, SaveLayoutPayload, { previous?: CanvasData }>({
    mutationFn: (payload) =>
      fetchJson<void>(
        `/api/client/consultations/${consultationId}/canvas/layout`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      ),
    onMutate: async (payload) => {
      const previous = queryClient.getQueryData<CanvasData>(canvasKey(consultationId));
      updateCanvasCache(queryClient, consultationId, (current) => ({
        ...current,
        viewport: payload.viewport,
        nodes: current.nodes.map((node) => ({
          ...node,
          position: payload.positions[node.id] ?? node.position,
        })),
      }));
      return { previous };
    },
    onError: (_error, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(canvasKey(consultationId), context.previous);
      }
    },
  });
}

// ---------------------------------------------------------------------------
// AI suggestions
// ---------------------------------------------------------------------------

function suggestionsKey(consultationId: string) {
  return ["canvas", consultationId, "suggestions"] as const;
}

export function useCanvasSuggestions(consultationId: string) {
  return useQuery<AiConnectionSuggestion[]>({
    queryKey: suggestionsKey(consultationId),
    queryFn: () =>
      fetchJson<AiConnectionSuggestion[]>(
        `/api/client/consultations/${consultationId}/canvas/suggestions`
      ),
    enabled: Boolean(consultationId),
  });
}

export function useAcceptSuggestion(consultationId: string) {
  const queryClient = useQueryClient();
  return useMutation<CanvasEdge, Error, string>({
    mutationFn: (suggestionId) =>
      fetchJson<CanvasEdge>(
        `/api/client/consultations/${consultationId}/canvas/suggestions/${suggestionId}`,
        { method: "POST" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: suggestionsKey(consultationId) });
      queryClient.invalidateQueries({ queryKey: canvasKey(consultationId) });
    },
  });
}

export function useRejectSuggestion(consultationId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (suggestionId) =>
      fetchJson<void>(
        `/api/client/consultations/${consultationId}/canvas/suggestions/${suggestionId}`,
        { method: "DELETE" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: suggestionsKey(consultationId) });
      queryClient.invalidateQueries({ queryKey: canvasKey(consultationId) });
    },
  });
}

export function useGenerateSuggestions(consultationId: string) {
  const queryClient = useQueryClient();
  return useMutation<{ message: string }, Error, void>({
    mutationFn: () =>
      fetchJson<{ message: string }>(
        `/api/client/consultations/${consultationId}/canvas/suggestions`,
        { method: "POST" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: suggestionsKey(consultationId) });
    },
  });
}
