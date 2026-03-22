import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Meeting,
  EvidenceEmail,
  Insight,
} from "@/types/db";
import { fetchJson } from "@/hooks/api";

export const MEETINGS_QUERY_KEY = ["meetings"] as const;

interface UseMeetingsOptions {
  includeArchived?: boolean;
}

export function useMeetings(options: UseMeetingsOptions = {}) {
  const includeArchived = options.includeArchived ?? false;
  return useQuery({
    queryKey: ["meetings", includeArchived ? "archived" : "active"],
    queryFn: () =>
      fetchJson<Meeting[]>(
        `/api/client/meetings${includeArchived ? "?archived=true" : ""}`
      ),
  });
}

export function useMeeting(id: string) {
  return useQuery({
    queryKey: ["meetings", id],
    queryFn: () =>
      fetchJson<{
        meeting: Meeting;
        themes: Insight[];
        people: Array<{ person_id: string }>;
        latestEvidenceEmail: EvidenceEmail | null;
      }>(`/api/client/meetings/${id}`),
    enabled: !!id,
  });
}

export function useArchiveMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/client/meetings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: true }),
      }).then((response) => {
        if (!response.ok && response.status !== 204) {
          throw new Error("Failed to archive meeting");
        }
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MEETINGS_QUERY_KEY }),
  });
}

export function useRestoreMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/client/meetings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: false }),
      }).then((response) => {
        if (!response.ok && response.status !== 204) {
          throw new Error("Failed to restore meeting");
        }
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MEETINGS_QUERY_KEY }),
  });
}
