import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/hooks/api";

export interface ColumnSuggestion {
  question: string;
  rationale: string | null;
}

export function useColumnSuggestions(roundId: string, enabled = false) {
  return useQuery<{ suggestions: ColumnSuggestion[] }>({
    queryKey: ["column-suggestions", roundId],
    queryFn: () =>
      fetchJson<{ suggestions: ColumnSuggestion[] }>(
        `/api/client/consultations/${roundId}/grid/column-suggestions`
      ),
    enabled: Boolean(roundId) && enabled,
    staleTime: 5 * 60 * 1000,
  });
}
