import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "@/hooks/api";
import type { GridData } from "@/types/grid";

export function useDeleteColumn(roundId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ columnId }: { columnId: string }) =>
      fetchJson(
        `/api/client/consultations/${roundId}/grid/columns/${columnId}`,
        { method: "DELETE" }
      ),
    onMutate: async ({ columnId }) => {
      await queryClient.cancelQueries({ queryKey: ["grid", roundId] });
      const previous = queryClient.getQueryData<GridData>(["grid", roundId]);
      queryClient.setQueryData(["grid", roundId], (old: GridData | undefined) =>
        old
          ? {
              ...old,
              columns: old.columns.filter((c) => c.id !== columnId),
              cells: old.cells.filter((c) => c.columnId !== columnId),
            }
          : old
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["grid", roundId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["grid", roundId] });
      queryClient.invalidateQueries({ queryKey: ["grid-cells", roundId] });
    },
  });
}
