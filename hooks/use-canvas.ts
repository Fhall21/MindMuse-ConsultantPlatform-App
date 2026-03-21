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
// Response shape from GET /api/client/rounds/[roundId]/canvas
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

function canvasKey(roundId: string) {
  return ["canvas", roundId] as const;
}

function updateCanvasCache(
  queryClient: ReturnType<typeof useQueryClient>,
  roundId: string,
  updater: (current: CanvasData) => CanvasData
) {
  queryClient.setQueryData<CanvasData>(canvasKey(roundId), (current) =>
    current ? updater(current) : current
  );
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useCanvas(roundId: string) {
  return useQuery<CanvasData>({
    queryKey: canvasKey(roundId),
    queryFn: () =>
      fetchJson<CanvasData>(
        `/api/client/rounds/${roundId}/canvas`
      ),
    enabled: Boolean(roundId),
  });
}

export function useCreateEdge(roundId: string) {
  const queryClient = useQueryClient();
  return useMutation<CanvasEdge, Error, CreateEdgePayload>({
    mutationFn: (payload) =>
      fetchJson<CanvasEdge>(
        `/api/client/rounds/${roundId}/canvas/edges`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      ),
    onSuccess: (createdEdge) => {
      updateCanvasCache(queryClient, roundId, (current) => ({
        ...current,
        edges: [
          createdEdge,
          ...current.edges.filter((edge) => edge.id !== createdEdge.id),
        ],
      }));
    },
  });
}

export function useUpdateEdge(roundId: string) {
  const queryClient = useQueryClient();
  return useMutation<CanvasEdge, Error, UpdateEdgePayload, { previous?: CanvasData }>({
    mutationFn: ({ id, ...payload }) =>
      fetchJson<CanvasEdge>(
        `/api/client/rounds/${roundId}/canvas/edges/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      ),
    onMutate: async ({ id, ...updates }) => {
      const previous = queryClient.getQueryData<CanvasData>(canvasKey(roundId));
      updateCanvasCache(queryClient, roundId, (current) => ({
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
        queryClient.setQueryData(canvasKey(roundId), context.previous);
      }
    },
    onSuccess: (updatedEdge) => {
      updateCanvasCache(queryClient, roundId, (current) => ({
        ...current,
        edges: current.edges.map((edge) =>
          edge.id === updatedEdge.id ? updatedEdge : edge
        ),
      }));
    },
  });
}

export function useDeleteEdge(roundId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string, { previous?: CanvasData }>({
    mutationFn: (edgeId) =>
      fetchJson<void>(
        `/api/client/rounds/${roundId}/canvas/edges/${edgeId}`,
        { method: "DELETE" }
      ),
    onMutate: async (edgeId) => {
      const previous = queryClient.getQueryData<CanvasData>(canvasKey(roundId));
      updateCanvasCache(queryClient, roundId, (current) => ({
        ...current,
        edges: current.edges.filter((edge) => edge.id !== edgeId),
      }));
      return { previous };
    },
    onError: (_error, _edgeId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(canvasKey(roundId), context.previous);
      }
    },
  });
}

export function useSaveLayout(roundId: string) {
  // Fire-and-forget layout save. No onMutate/onError cache updates — these caused
  // TanStack Query to re-render on every drag frame, creating drag lag.
  return useMutation<void, Error, SaveLayoutPayload>({
    mutationFn: (payload) =>
      fetchJson<void>(
        `/api/client/rounds/${roundId}/canvas/layout`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      ),
  });
}

// ---------------------------------------------------------------------------
// AI suggestions
// ---------------------------------------------------------------------------

function suggestionsKey(roundId: string) {
  return ["canvas", roundId, "suggestions"] as const;
}

export function useCanvasSuggestions(roundId: string) {
  return useQuery<AiConnectionSuggestion[]>({
    queryKey: suggestionsKey(roundId),
    queryFn: () =>
      fetchJson<AiConnectionSuggestion[]>(
        `/api/client/rounds/${roundId}/canvas/suggestions`
      ),
    enabled: Boolean(roundId),
  });
}

export function useAcceptSuggestion(roundId: string) {
  const queryClient = useQueryClient();
  return useMutation<CanvasEdge, Error, string>({
    mutationFn: (suggestionId) =>
      fetchJson<CanvasEdge>(
        `/api/client/rounds/${roundId}/canvas/suggestions/${suggestionId}`,
        { method: "POST" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: suggestionsKey(roundId) });
      queryClient.invalidateQueries({ queryKey: canvasKey(roundId) });
    },
  });
}

export function useRejectSuggestion(roundId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (suggestionId) =>
      fetchJson<void>(
        `/api/client/rounds/${roundId}/canvas/suggestions/${suggestionId}`,
        { method: "DELETE" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: suggestionsKey(roundId) });
      queryClient.invalidateQueries({ queryKey: canvasKey(roundId) });
    },
  });
}

export function useGenerateSuggestions(roundId: string) {
  const queryClient = useQueryClient();
  return useMutation<{ message: string }, Error, void>({
    mutationFn: () =>
      fetchJson<{ message: string }>(
        `/api/client/rounds/${roundId}/canvas/suggestions`,
        { method: "POST" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: suggestionsKey(roundId) });
    },
  });
}
