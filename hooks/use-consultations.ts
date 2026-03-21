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

export function useConsultationDetail(consultationId: string) {
  return useQuery({
    queryKey: ["consultations", consultationId, "detail"],
    queryFn: async () => getRoundDetail(consultationId),
    enabled: Boolean(consultationId),
  });
}

export type { RoundDetail };
