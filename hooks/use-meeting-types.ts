import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MeetingType } from "@/types/db";
import { fetchJson } from "@/hooks/api";

export const MEETING_TYPES_QUERY_KEY = ["meeting-types"] as const;

export function useMeetingTypes() {
  return useQuery({
    queryKey: MEETING_TYPES_QUERY_KEY,
    queryFn: () => fetchJson<MeetingType[]>("/api/client/meeting-types"),
  });
}

export function useCreateMeetingType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { label: string; code: string }) =>
      fetchJson<MeetingType>("/api/client/meeting-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MEETING_TYPES_QUERY_KEY }),
  });
}

export function useUpdateMeetingType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; label?: string; code?: string }) =>
      fetchJson<MeetingType>(`/api/client/meeting-types/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MEETING_TYPES_QUERY_KEY }),
  });
}

export function useArchiveMeetingType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/client/meeting-types/${id}`, { method: "DELETE" }).then((r) => {
        if (!r.ok && r.status !== 204) throw new Error("Failed to archive meeting type");
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MEETING_TYPES_QUERY_KEY }),
  });
}

export function useDeleteMeetingType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/client/meeting-types/${id}?force=true`, { method: "DELETE" }).then((r) => {
        if (!r.ok && r.status !== 204) throw new Error("Failed to delete meeting type");
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MEETING_TYPES_QUERY_KEY }),
  });
}
