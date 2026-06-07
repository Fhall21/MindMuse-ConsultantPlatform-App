import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "@/hooks/api";
import type { GridData } from "@/types/grid";

export function useUpdateColumnPosition(roundId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      columnId,
      position,
    }: {
      columnId: string;
      position: number;
    }) =>
      fetchJson(
        `/api/client/consultations/${roundId}/grid/columns/${columnId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ position }),
        }
      ),
    onMutate: async ({ columnId, position }) => {
      await queryClient.cancelQueries({ queryKey: ["grid", roundId] });
      const previous = queryClient.getQueryData<GridData>(["grid", roundId]);
      queryClient.setQueryData(["grid", roundId], (old: GridData | undefined) => {
        if (!old) return old;
        const updated = old.columns.map((c) =>
          c.id === columnId ? { ...c, position } : c
        );
        return {
          ...old,
          columns: updated.sort((a, b) => a.position - b.position),
        };
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["grid", roundId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["grid", roundId] });
    },
  });
}
