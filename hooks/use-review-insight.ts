import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "@/hooks/api";
import type { GridReviewState, InsightWithLinks } from "@/types/grid";

function applyReviewState(
  insights: InsightWithLinks[],
  insightId: string,
  state: GridReviewState
): InsightWithLinks[] {
  return insights.map((insight) =>
    insight.id === insightId
      ? {
          ...insight,
          gridReviewState: state,
          accepted: state === "accepted",
          rejected: state === "rejected",
        }
      : insight
  );
}

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
      await queryClient.cancelQueries({ queryKey: ["grid-insights", roundId] });

      const previousCell = queryClient.getQueryData<{ insights: InsightWithLinks[] }>(
        ["cell-insights", cellId]
      );
      const previousGrid = queryClient.getQueryData<{ insights: InsightWithLinks[] }>(
        ["grid-insights", roundId]
      );

      queryClient.setQueryData(
        ["cell-insights", cellId],
        (old: { insights: InsightWithLinks[] } | undefined) => ({
          insights: applyReviewState(old?.insights ?? [], insightId, state),
        })
      );
      queryClient.setQueryData(
        ["grid-insights", roundId],
        (old: { insights: InsightWithLinks[] } | undefined) => ({
          insights: applyReviewState(old?.insights ?? [], insightId, state),
        })
      );

      return { previousCell, previousGrid, cellId };
    },
    onError: (_err, _vars, context) => {
      if (!context) return;
      queryClient.setQueryData(
        ["cell-insights", context.cellId],
        context.previousCell
      );
      queryClient.setQueryData(["grid-insights", roundId], context.previousGrid);
    },
    onSettled: (_data, _err, { cellId }) => {
      queryClient.invalidateQueries({ queryKey: ["cell-insights", cellId] });
      queryClient.invalidateQueries({ queryKey: ["grid-insights", roundId] });
      queryClient.invalidateQueries({ queryKey: ["grid-cells", roundId] });
    },
  });
}
