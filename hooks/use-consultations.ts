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

export function useRoundDetail(roundId: string) {
  return useQuery({
    queryKey: ["consultation_rounds", roundId, "detail"],
    queryFn: async () => getRoundDetail(roundId),
    enabled: Boolean(roundId),
  });
}

export type { RoundDetail };
