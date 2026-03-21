import { useQuery } from "@tanstack/react-query";
import type { AuditLogEntry } from "@/types/db";
import { fetchJson } from "@/hooks/api";

export function useMeetingAuditEvents(meetingId: string) {
  return useQuery({
    queryKey: ["audit_log", "meeting", meetingId],
    queryFn: () =>
      fetchJson<AuditLogEntry[]>(`/api/client/audit/meetings/${meetingId}`),
    enabled: !!meetingId,
  });
}

export const useAuditEvents = useMeetingAuditEvents;

export function useRoundAuditEvents(roundId: string) {
  return useQuery({
    queryKey: ["audit_log", "round", roundId],
    queryFn: () =>
      fetchJson<AuditLogEntry[]>(`/api/client/audit/rounds/${roundId}`),
    enabled: !!roundId,
  });
}
