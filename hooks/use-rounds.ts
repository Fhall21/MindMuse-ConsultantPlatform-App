import { useQuery } from "@tanstack/react-query";

import {
  getRoundDetail,
  type RoundDetail,
} from "@/lib/actions/round-workflow";
import type { ConsultationRound } from "@/types/db";
import { fetchJson } from "@/hooks/api";

export function useConsultationRounds() {
  return useQuery({
    queryKey: ["consultation_rounds"],
    queryFn: () => fetchJson<ConsultationRound[]>("/api/client/rounds"),
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
