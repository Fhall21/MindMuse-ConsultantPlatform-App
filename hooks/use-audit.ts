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
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as AuditLogEntry[];
    },
    enabled: !!consultationId,
  });
}
