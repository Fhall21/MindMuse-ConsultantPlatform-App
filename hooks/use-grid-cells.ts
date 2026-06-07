import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/hooks/api";
import type { GridCell } from "@/types/grid";

export function getRefetchInterval(
  data: { cells?: { status: string }[] } | undefined
): number | false {
  const hasGenerating = data?.cells?.some((c) => c.status === "generating");
  return hasGenerating ? 2000 : false;
}

export function useGridCells(roundId: string) {
  return useQuery<{ cells: GridCell[] }>({
    queryKey: ["grid-cells", roundId],
    queryFn: () =>
      fetchJson<{ cells: GridCell[] }>(
        `/api/client/consultations/${roundId}/grid/cells`
      ),
    enabled: Boolean(roundId),
    refetchInterval: (query) => getRefetchInterval(query.state.data),
  });
}
