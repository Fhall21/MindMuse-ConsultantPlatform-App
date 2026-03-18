import { useQuery } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";
import {
  getRoundDetail,
  type RoundDetail,
} from "@/lib/actions/round-workflow";
import type { ConsultationRound } from "@/types/db";

export function useConsultationRounds() {
  return useQuery({
    queryKey: ["consultation_rounds"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("consultation_rounds")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      return (data ?? []) as ConsultationRound[];
    },
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
