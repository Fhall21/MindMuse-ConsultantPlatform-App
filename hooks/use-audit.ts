import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { AuditLogEntry } from "@/types/db";

export function useAuditEvents(consultationId: string) {
  return useQuery({
    queryKey: ["audit_log", consultationId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("audit_log")
        .select("*")
        .eq("consultation_id", consultationId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AuditLogEntry[];
    },
    enabled: !!consultationId,
  });
}

export function useRoundAuditEvents(roundId: string) {
  return useQuery({
    queryKey: ["audit_log", "round", roundId],
    queryFn: async () => {
      const supabase = createClient();

      // Round-level events (created/updated/deleted) — entity_id is the round id
      const [{ data: roundEntityEvents, error: e1 }, { data: roundPayloadEvents, error: e2 }] =
        await Promise.all([
          supabase
            .from("audit_log")
            .select("*")
            .eq("entity_type", "consultation_round")
            .eq("entity_id", roundId),
          supabase
            .from("audit_log")
            .select("*")
            .filter("payload->>round_id", "eq", roundId),
        ]);

      if (e1) throw e1;
      if (e2) throw e2;

      const seen = new Set<string>();
      const merged: AuditLogEntry[] = [];
      for (const event of [...(roundEntityEvents ?? []), ...(roundPayloadEvents ?? [])]) {
        if (!seen.has(event.id)) {
          seen.add(event.id);
          merged.push(event as AuditLogEntry);
        }
      }
      merged.sort((a, b) => b.created_at.localeCompare(a.created_at));
      return merged;
    },
    enabled: !!roundId,
  });
}
