import { useQuery } from "@tanstack/react-query";
import type { Person } from "@/types/db";
import { fetchJson } from "@/hooks/api";

export function usePeople() {
  return useQuery({
    queryKey: ["people"],
    queryFn: () => fetchJson<Person[]>("/api/client/people"),
  });
}

export function useConsultationPeople(consultationId: string) {
  return useQuery({
    queryKey: ["consultation_people", consultationId],
    queryFn: () =>
      fetchJson<Person[]>(`/api/client/consultations/${consultationId}/people`),
    enabled: !!consultationId,
  });
}
