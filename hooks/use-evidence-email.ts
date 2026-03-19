import { useQuery } from "@tanstack/react-query";
import type { EvidenceEmail } from "@/types/db";
import { fetchJson } from "@/hooks/api";

export function useEvidenceEmails(consultationId: string) {
  return useQuery({
    queryKey: ["evidence_emails", consultationId],
    queryFn: () =>
      fetchJson<EvidenceEmail[]>(
        `/api/client/evidence-emails/consultations/${consultationId}`
      ),
    enabled: !!consultationId,
  });
}
