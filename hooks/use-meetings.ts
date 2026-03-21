import { useQuery } from "@tanstack/react-query";
import type {
  Meeting,
  EvidenceEmail,
  Insight,
} from "@/types/db";
import { fetchJson } from "@/hooks/api";

export function useMeetings() {
  return useQuery({
    queryKey: ["meetings"],
    queryFn: () => fetchJson<Meeting[]>("/api/client/meetings"),
  });
}

export function useMeeting(id: string) {
  return useQuery({
    queryKey: ["meetings", id],
    queryFn: () =>
      fetchJson<{
        meeting: Meeting;
        themes: Insight[];
        people: Array<{ person_id: string }>;
        latestEvidenceEmail: EvidenceEmail | null;
      }>(`/api/client/meetings/${id}`),
    enabled: !!id,
  });
}
