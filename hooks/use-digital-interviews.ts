import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/hooks/api";
import type { DigitalInterviewFlowListItem } from "@/lib/data/digital-interviews";

export function useDigitalInterviews() {
  return useQuery({
    queryKey: ["digital_interviews"],
    queryFn: () =>
      fetchJson<{ data: DigitalInterviewFlowListItem[] }>(
        "/api/client/digital-interviews"
      ).then((r) => r.data),
  });
}

export function useDigitalInterviewDetail(flowId: string) {
  return useQuery({
    queryKey: ["digital_interviews", flowId],
    queryFn: () =>
      fetchJson<{ data: DigitalInterviewFlowListItem }>(
        `/api/client/digital-interviews/${flowId}`
      ).then((r) => r.data),
    enabled: Boolean(flowId),
  });
}
