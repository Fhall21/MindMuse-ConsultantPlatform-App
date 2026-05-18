import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "@/hooks/api";

export interface ResearchInsightLibraryEntry {
  insightId: string;
  label: string;
  description: string | null;
  researchSessionId: string;
  researchSessionQuery: string;
  createdAt: string;
  quoteCount: number;
  placementCount: number;
}

export interface ExtractInput {
  consultationId: string;
  researchSessionId: string;
  quote: string;
  locator: Record<string, unknown>;
  label: string;
  description?: string | null;
  positionX?: number;
  positionY?: number;
}

export interface PlaceInput {
  consultationId: string;
  insightId: string;
  positionX?: number;
  positionY?: number;
}

export function useResearchInsightLibrary(query: string | null, limit = 50) {
  return useQuery({
    queryKey: ["research-insight-library", query ?? "", limit] as const,
    queryFn: () => {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      params.set("limit", String(limit));
      return fetchJson<{ items: ResearchInsightLibraryEntry[] }>(
        `/api/client/insights/research/library?${params.toString()}`
      ).then((r) => r.items);
    },
    staleTime: 10_000,
  });
}

export function useExtractResearchInsight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ExtractInput) =>
      fetchJson<{ insight: { id: string }; quote: { id: string }; placement: unknown }>(
        "/api/client/insights/research",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        }
      ),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["research-insight-library"] });
      qc.invalidateQueries({
        queryKey: ["consultation-canvas", variables.consultationId],
      });
      // Generic canvas key fallback (different repos shape the key differently)
      qc.invalidateQueries({ queryKey: ["canvas", variables.consultationId] });
    },
  });
}

export function usePlaceResearchInsight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PlaceInput) =>
      fetchJson<{ placement: unknown }>(
        `/api/client/insights/research/${input.insightId}/place`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            consultationId: input.consultationId,
            positionX: input.positionX,
            positionY: input.positionY,
          }),
        }
      ),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["research-insight-library"] });
      qc.invalidateQueries({
        queryKey: ["consultation-canvas", variables.consultationId],
      });
      qc.invalidateQueries({ queryKey: ["canvas", variables.consultationId] });
    },
  });
}
