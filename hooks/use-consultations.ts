import { useQuery } from "@tanstack/react-query";

import {
  getRoundDetail,
  type RoundDetail,
} from "@/lib/actions/consultation-workflow";
import type { Consultation } from "@/types/db";
import { fetchJson } from "@/hooks/api";

export function useConsultations() {
  return useQuery({
    queryKey: ["consultations"],
    queryFn: () => fetchJson<Consultation[]>("/api/client/consultations"),
  });
}

export function useConsultationGroupDetail(consultationGroupId: string) {
  return useQuery({
    queryKey: ["consultation_rounds", consultationGroupId, "detail"],
    queryFn: async () => getRoundDetail(consultationGroupId),
    enabled: Boolean(consultationGroupId),
  });
}

export function useRoundDetail(consultationGroupId: string) {
  return useConsultationGroupDetail(consultationGroupId);
}

export type { RoundDetail };
