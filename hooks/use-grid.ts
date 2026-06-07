import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/hooks/api";
import type { GridData } from "@/types/grid";

export function useGrid(roundId: string) {
  return useQuery<GridData>({
    queryKey: ["grid", roundId],
    queryFn: () =>
      fetchJson<GridData>(`/api/client/consultations/${roundId}/grid`),
    enabled: Boolean(roundId),
  });
}
