import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/hooks/api";
import type { ClientFeatureFlags } from "@/lib/feature-flags";

const DEFAULTS: ClientFeatureFlags = {
  researchExtractionEnabled: false,
  canvasSpatialLayout: false,
};

export function useFeatureFlags() {
  return useQuery<ClientFeatureFlags>({
    queryKey: ["feature-flags"],
    queryFn: () => fetchJson<ClientFeatureFlags>("/api/client/feature-flags"),
    staleTime: 60_000,
    placeholderData: DEFAULTS,
  });
}

export function useResearchExtractionEnabled(): boolean {
  const { data } = useFeatureFlags();
  return data?.researchExtractionEnabled ?? false;
}

export function useCanvasSpatialLayoutEnabled(): boolean {
  const { data } = useFeatureFlags();
  return data?.canvasSpatialLayout ?? false;
}
