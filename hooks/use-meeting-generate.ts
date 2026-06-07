import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "@/hooks/api";
import { useTriggerGeneration } from "@/hooks/use-trigger-generation";
import type { CellStatus, GridCell, MeetingGenerateResult } from "@/types/grid";

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

function setMeetingCellStatuses(
  queryClient: ReturnType<typeof useQueryClient>,
  roundId: string,
  meetingId: string,
  status: CellStatus
) {
  queryClient.setQueryData<{ cells: GridCell[] }>(["grid-cells", roundId], (old) => {
    if (!old?.cells) return old;
    return {
      cells: old.cells.map((cell) =>
        cell.meetingId === meetingId ? { ...cell, status } : cell
      ),
    };
  });
}

export function useGridGenerationLoop(roundId: string, selectedCellId?: string | null) {
  const queryClient = useQueryClient();
  const triggerGeneration = useTriggerGeneration(roundId);
  const meetingGenerate = useMeetingGenerate(roundId, selectedCellId);

  const runMeetingLoop = useCallback(
    async (meetingIds: string[], options?: { retry?: boolean }) => {
      for (const meetingId of meetingIds) {
        setMeetingCellStatuses(queryClient, roundId, meetingId, "generating");
        try {
          await meetingGenerate.mutateAsync({ meetingId, retry: options?.retry });
        } catch {
          setMeetingCellStatuses(queryClient, roundId, meetingId, "failed");
        }
      }
    },
    [meetingGenerate, queryClient, roundId]
  );

  const generateColumn = useCallback(
    async (columnId: string) => {
      const { meetingIds } = await triggerGeneration.mutateAsync({ columnId });
      if (meetingIds.length === 0) {
        await queryClient.invalidateQueries({ queryKey: ["grid-cells", roundId] });
        return;
      }
      await runMeetingLoop(meetingIds);
    },
    [queryClient, roundId, runMeetingLoop, triggerGeneration]
  );

  const retryMeeting = useCallback(
    (meetingId: string) => runMeetingLoop([meetingId], { retry: true }),
    [runMeetingLoop]
  );

  return {
    generateColumn,
    runMeetingLoop,
    retryMeeting,
    isGenerating:
      triggerGeneration.isPending ||
      meetingGenerate.isPending,
  };
}
