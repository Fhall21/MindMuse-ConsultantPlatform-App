import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addUserTheme } from "@/lib/actions/themes";
import type { Insight } from "@/types/db";
import { fetchJson } from "@/hooks/api";

const meetingThemesKey = (meetingId: string) => ["themes", "meeting", meetingId] as const;

export function useMeetingThemes(meetingId: string) {
  return useQuery({
    queryKey: meetingThemesKey(meetingId),
    queryFn: () =>
      fetchJson<Insight[]>(`/api/client/themes/consultations/${meetingId}?include_rejected=true`),
    enabled: !!meetingId,
  });
}

export function useCreateMeetingTheme(meetingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { label: string; description?: string }) =>
      addUserTheme(meetingId, params.label, params.description),
    onSuccess: () => qc.invalidateQueries({ queryKey: meetingThemesKey(meetingId) }),
  });
}

export const useThemes = useMeetingThemes;
