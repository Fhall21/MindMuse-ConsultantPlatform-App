import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "@/hooks/api";
import type { GridReviewState, InsightWithLinks } from "@/types/grid";

export function useReviewInsight(roundId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      insightId,
      state,
      cellId,
      editedText,
      editScope,
    }: {
      insightId: string;
      state: GridReviewState;
      cellId: string;
      editedText?: string;
      editScope?: "cell" | "all";
    }) =>
      fetchJson(`/api/client/insights/${insightId}/grid-review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cellId,
          gridReviewState: state,
          ...(editedText
            ? { editedText, editScope: editScope ?? "cell" }
            : {}),
        }),
      }),
    onMutate: async ({ insightId, state, cellId }) => {
      await queryClient.cancelQueries({ queryKey: ["cell-insights", cellId] });
      const previous = queryClient.getQueryData<{ insights: InsightWithLinks[] }>(
        ["cell-insights", cellId]
      );
      queryClient.setQueryData(
        ["cell-insights", cellId],
        (old: { insights: InsightWithLinks[] } | undefined) => ({
          insights:
            old?.insights?.map((i) =>
              i.id === insightId ? { ...i, gridReviewState: state } : i
            ) ?? [],
        })
      );
      return { previous, cellId };
    },
    onError: (_err, _vars, context) => {
      if (context) {
        queryClient.setQueryData(
          ["cell-insights", context.cellId],
          context.previous
        );
      }
    },
    onSettled: (_data, _err, { cellId }) => {
      queryClient.invalidateQueries({ queryKey: ["cell-insights", cellId] });
      queryClient.invalidateQueries({ queryKey: ["grid-cells", roundId] });
    },
  });
}
