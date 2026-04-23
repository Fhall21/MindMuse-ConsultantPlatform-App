import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/hooks/api";
import type { DigitalInterviewFlowListItem } from "@/lib/data/digital-interviews";

export function useDigitalInterviews() {
  return useQuery({
    queryKey: ["digital-interviews", "flows"],
    queryFn: async () => {
      const response = await fetchJson<{ data: DigitalInterviewFlowListItem[] }>(
        "/api/client/digital-interviews"
      );
      return response.data;
    },
  });
}

export function useDigitalInterviewDetail(flowId: string) {
  return useQuery({
    queryKey: ["digital-interviews", "flow", flowId],
    queryFn: async () => {
      const response = await fetchJson<{ data: DigitalInterviewFlowListItem }>(
        `/api/client/digital-interviews/${flowId}`
      );
      return response.data;
    },
    enabled: Boolean(flowId),
  });
}

export function useDigitalInterviewUnreadCount() {
  return useQuery({
    queryKey: ["digital-interviews", "unread-count"],
    queryFn: () => fetchJson<number>("/api/client/digital-interviews/unread-count"),
    refetchInterval: 60_000,
    staleTime: 60_000,
  });
}
