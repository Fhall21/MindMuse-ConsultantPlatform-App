import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "@/hooks/api";

export function useTriggerGeneration(roundId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ columnId }: { columnId: string }) =>
      fetchJson<{ meetingIds: string[] }>(
        `/api/client/consultations/${roundId}/grid/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ columnId }),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grid-cells", roundId] });
    },
  });
}
