import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "@/hooks/api";
import type { InsightDecisionLog } from "@/types/db";

export function useInsightSignals() {
  return useQuery({
    queryKey: ["insight-signals"],
    queryFn: () =>
      fetchJson<InsightDecisionLog[]>("/api/client/ai-preferences/signals"),
  });
}

export function useUpdateSignalRationale() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      signalId,
      rationale,
    }: {
      signalId: string;
      rationale: string | undefined;
    }) =>
      fetchJson<InsightDecisionLog>(
        `/api/client/ai-preferences/signals/${signalId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rationale }),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["insight-signals"] });
    },
  });
}

export function useDeleteSignal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (signalId: string) =>
      fetchJson<{ ok: boolean }>(
        `/api/client/ai-preferences/signals/${signalId}`,
        { method: "DELETE" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["insight-signals"] });
    },
  });
}
