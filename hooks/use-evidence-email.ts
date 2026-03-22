import { useQuery } from "@tanstack/react-query";
import type { EvidenceEmail } from "@/types/db";
import { fetchJson } from "@/hooks/api";

export function useMeetingEvidenceEmails(meetingId: string) {
  return useQuery({
    queryKey: ["evidence_emails", "meeting", meetingId],
    queryFn: () =>
      fetchJson<EvidenceEmail[]>(
        `/api/client/evidence-emails/consultations/${meetingId}`
      ),
    enabled: !!meetingId,
  });
}

export const useEvidenceEmails = useMeetingEvidenceEmails;
