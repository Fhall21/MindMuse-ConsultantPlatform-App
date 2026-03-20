import { useQuery } from "@tanstack/react-query";
import type { Insight } from "@/types/db";
import { fetchJson } from "@/hooks/api";

export function useThemes(consultationId: string) {
  return useQuery({
    queryKey: ["themes", consultationId],
    queryFn: () =>
      fetchJson<Insight[]>(`/api/client/themes/consultations/${consultationId}`),
    enabled: !!consultationId,
  });
}
