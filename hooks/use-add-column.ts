import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "@/hooks/api";
import type { GridColumn } from "@/types/grid";

export function useAddColumn(roundId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ question }: { question: string }) =>
      fetchJson<GridColumn>(
        `/api/client/consultations/${roundId}/grid/columns`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question }),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grid", roundId] });
    },
  });
}
