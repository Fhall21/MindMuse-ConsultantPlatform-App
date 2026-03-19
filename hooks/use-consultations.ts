import { useQuery } from "@tanstack/react-query";
import type {
  Consultation,
  ConsultationRound,
  EvidenceEmail,
  Theme,
} from "@/types/db";
import { fetchJson } from "@/hooks/api";

export function useConsultations() {
  return useQuery({
    queryKey: ["consultations"],
    queryFn: () => fetchJson<Consultation[]>("/api/client/consultations"),
  });
}

export function useConsultation(id: string) {
  return useQuery({
    queryKey: ["consultations", id],
    queryFn: () =>
      fetchJson<{
        consultation: Consultation;
        themes: Theme[];
        people: Array<{ person_id: string }>;
        latestEvidenceEmail: EvidenceEmail | null;
      }>(`/api/client/consultations/${id}`),
    enabled: !!id,
  });
}

export function useConsultationRounds() {
  return useQuery({
    queryKey: ["consultation_rounds"],
    queryFn: () => fetchJson<ConsultationRound[]>("/api/client/rounds"),
  });
}
