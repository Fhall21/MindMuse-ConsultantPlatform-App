import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/hooks/api";
import type { MeetingGridInsight } from "@/app/api/client/meetings/[id]/grid-insights/route";

export function useMeetingGridInsights(meetingId: string) {
  return useQuery<{ insights: MeetingGridInsight[] }>({
    queryKey: ["meeting-grid-insights", meetingId],
    queryFn: () =>
      fetchJson<{ insights: MeetingGridInsight[] }>(
        `/api/client/meetings/${meetingId}/grid-insights`
      ),
    enabled: Boolean(meetingId),
  });
}
