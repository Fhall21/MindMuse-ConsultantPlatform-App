import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "@/hooks/api";

export { useResearchExtractionEnabled } from "@/hooks/use-feature-flags";

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
      qc.invalidateQueries({
        queryKey: ["consultation-canvas", variables.consultationId],
      });
      // Generic canvas key fallback (different repos shape the key differently)
      qc.invalidateQueries({ queryKey: ["canvas", variables.consultationId] });
    },
  });
}
