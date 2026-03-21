import { useQuery } from "@tanstack/react-query";
import type { Insight } from "@/types/db";
import { fetchJson } from "@/hooks/api";

export function useMeetingThemes(meetingId: string) {
  return useQuery({
    queryKey: ["themes", "meeting", meetingId],
    queryFn: () =>
      fetchJson<Insight[]>(`/api/client/themes/consultations/${meetingId}`),
    enabled: !!meetingId,
  });
}

export const useThemes = useMeetingThemes;
