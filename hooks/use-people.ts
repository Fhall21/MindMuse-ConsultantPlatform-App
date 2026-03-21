import { useQuery } from "@tanstack/react-query";
import type { Person } from "@/types/db";
import { fetchJson } from "@/hooks/api";

export function usePeople() {
  return useQuery({
    queryKey: ["people"],
    queryFn: () => fetchJson<Person[]>("/api/client/people"),
  });
}

export function useMeetingPeople(meetingId: string) {
  return useQuery({
    queryKey: ["meeting_people", meetingId],
    queryFn: () =>
      fetchJson<Person[]>(`/api/client/meetings/${meetingId}/people`),
    enabled: !!meetingId,
  });
}

export const useConsultationPeople = useMeetingPeople;
