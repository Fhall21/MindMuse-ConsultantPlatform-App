import { useQuery } from "@tanstack/react-query";
import type { AuditLogEntry } from "@/types/db";
import { fetchJson } from "@/hooks/api";

export function useAuditEvents(consultationId: string) {
  return useQuery({
    queryKey: ["audit_log", consultationId],
    queryFn: () =>
      fetchJson<AuditLogEntry[]>(
        `/api/client/audit/consultations/${consultationId}`
      ),
    enabled: !!consultationId,
  });
}

export function useConsultationGroupAuditEvents(consultationGroupId: string) {
  return useQuery({
    queryKey: ["audit_log", "consultation_group", consultationGroupId],
    queryFn: () =>
      fetchJson<AuditLogEntry[]>(`/api/client/audit/consultation-groups/${consultationGroupId}`),
    enabled: !!consultationGroupId,
  });
}

export function useRoundAuditEvents(consultationGroupId: string) {
  return useConsultationGroupAuditEvents(consultationGroupId);
}
