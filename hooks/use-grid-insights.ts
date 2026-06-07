import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/hooks/api";
import type { InsightWithLinks } from "@/types/grid";

export function useGridInsights(roundId: string, enabled = false) {
  return useQuery<{ insights: InsightWithLinks[] }>({
    queryKey: ["grid-insights", roundId],
    queryFn: () =>
      fetchJson<{ insights: InsightWithLinks[] }>(
        `/api/client/consultations/${roundId}/grid/insights`
      ),
    enabled: Boolean(roundId) && enabled,
  });
}
