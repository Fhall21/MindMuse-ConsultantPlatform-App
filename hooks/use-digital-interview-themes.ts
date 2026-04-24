import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "@/hooks/api";
import type { DigitalInterviewTheme } from "@/lib/data/digital-interview-themes";
import type { DigitalInterviewResponseRecord } from "@/lib/data/digital-interviews";

export function useDigitalInterviewThemes(flowId: string) {
  return useQuery({
    queryKey: ["digital-interviews", "themes", flowId],
    queryFn: () =>
      fetchJson<{ data: DigitalInterviewTheme[] }>(`/api/client/digital-interviews/${flowId}/themes`).then(
        (r) => r.data
      ),
    enabled: Boolean(flowId),
  });
}

export function useDigitalInterviewTranscript(flowId: string, responseId: string | null) {
  return useQuery({
    queryKey: ["digital-interviews", "transcript", flowId, responseId],
    queryFn: () =>
      fetchJson<{ data: DigitalInterviewResponseRecord }>(
        `/api/client/digital-interviews/${flowId}/responses/${responseId}/transcript`
      ).then((r) => r.data),
    enabled: Boolean(flowId) && Boolean(responseId),
  });
}

export function useSaveDigitalInterviewThemes(flowId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (themes: Array<{ label: string; description?: string | null }>) =>
      fetchJson<{ data: DigitalInterviewTheme[] }>(
        `/api/client/digital-interviews/${flowId}/themes`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ themes }) }
      ).then((r) => r.data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["digital-interviews", "themes", flowId] }),
  });
}

export function useAcceptDigitalInterviewTheme(flowId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (themeId: string) =>
      fetch(`/api/client/digital-interviews/${flowId}/themes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept", themeId }),
      }).then((r) => { if (!r.ok && r.status !== 204) throw new Error("Failed to accept theme"); }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["digital-interviews", "themes", flowId] }),
  });
}

export function useRejectDigitalInterviewTheme(flowId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (themeId: string) =>
      fetch(`/api/client/digital-interviews/${flowId}/themes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", themeId }),
      }).then((r) => { if (!r.ok && r.status !== 204) throw new Error("Failed to reject theme"); }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["digital-interviews", "themes", flowId] }),
  });
}
