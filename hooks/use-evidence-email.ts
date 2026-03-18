import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { EvidenceEmail } from "@/types/db";

export function useEvidenceEmails(consultationId: string) {
  return useQuery({
    queryKey: ["evidence_emails", consultationId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("evidence_emails")
        .select("*")
        .eq("consultation_id", consultationId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as EvidenceEmail[];
    },
    enabled: !!consultationId,
  });
}
