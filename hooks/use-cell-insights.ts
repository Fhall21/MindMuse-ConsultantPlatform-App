import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/hooks/api";
import type { InsightWithLinks } from "@/types/grid";

export function useCellInsights(roundId: string, cellId: string | null) {
  return useQuery<{ insights: InsightWithLinks[] }>({
    queryKey: ["cell-insights", cellId],
    queryFn: () =>
      fetchJson<{ insights: InsightWithLinks[] }>(
        `/api/client/consultations/${roundId}/grid/cells/${cellId}/insights`
      ),
    enabled: Boolean(roundId) && Boolean(cellId),
  });
}
