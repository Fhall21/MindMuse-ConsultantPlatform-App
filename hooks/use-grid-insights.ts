import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/hooks/api";
import type { InsightWithLinks } from "@/types/grid";

export function useGridInsights(
  roundId: string,
  enabled = false,
  options?: { pollMissingCellIds?: string[] }
) {
  return useQuery<{ insights: InsightWithLinks[] }>({
    queryKey: ["grid-insights", roundId],
    queryFn: () =>
      fetchJson<{ insights: InsightWithLinks[] }>(
        `/api/client/consultations/${roundId}/grid/insights`
      ),
    enabled: Boolean(roundId) && enabled,
    refetchInterval: (query) => {
      const missingCellIds = options?.pollMissingCellIds ?? [];
      if (missingCellIds.length === 0) return false;

      const returnedCellIds = new Set(
        query.state.data?.insights.map((insight) => insight.gridCellId) ?? []
      );
      return missingCellIds.some((cellId) => !returnedCellIds.has(cellId))
        ? 2000
        : false;
    },
  });
}
