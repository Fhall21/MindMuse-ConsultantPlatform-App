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

export function useRoundAuditEvents(roundId: string) {
  return useQuery({
    queryKey: ["audit_log", "round", roundId],
    queryFn: () =>
      fetchJson<AuditLogEntry[]>(`/api/client/audit/rounds/${roundId}`),
    enabled: !!roundId,
  });
}
