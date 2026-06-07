import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "@/hooks/api";
import type { MeetingGenerateResult } from "@/types/grid";

export function useMeetingGenerate(roundId: string, selectedCellId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ meetingId, retry }: { meetingId: string; retry?: boolean }) =>
      fetchJson<MeetingGenerateResult>(
        `/api/client/consultations/${roundId}/grid/meetings/${meetingId}/generate${retry ? "?retry=true" : ""}`,
        { method: "POST" }
      ),
    onSuccess: (_data, { meetingId: _meetingId }) => {
      queryClient.invalidateQueries({ queryKey: ["grid-cells", roundId] });
      if (selectedCellId) {
        queryClient.invalidateQueries({
          queryKey: ["cell-insights", selectedCellId],
        });
      }
    },
  });
}
