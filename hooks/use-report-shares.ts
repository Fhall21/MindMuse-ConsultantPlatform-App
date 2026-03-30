import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "@/hooks/api";
import type {
  ReportShareLinkListItem,
  UserReportShareSettingsState,
} from "@/types/report-share";
import type {
  CreateReportShareLinkFormData,
  ReportShareSettingsFormData,
} from "@/lib/validations/report-share";

export function useReportShareSettings() {
  return useQuery<UserReportShareSettingsState>({
    queryKey: ["report_share_settings"],
    queryFn: () => fetchJson<UserReportShareSettingsState>("/api/client/report-share-settings"),
  });
}

export function useUpdateReportShareSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ReportShareSettingsFormData) =>
      fetchJson<UserReportShareSettingsState>("/api/client/report-share-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report_share_settings"] });
    },
  });
}

export function useReportShareLinks(artifactId: string) {
  return useQuery<ReportShareLinkListItem[]>({
    queryKey: ["report_share_links", artifactId],
    queryFn: () => fetchJson<ReportShareLinkListItem[]>(`/api/reports/${artifactId}/share`),
    enabled: Boolean(artifactId),
  });
}

export function useCreateReportShareLink(artifactId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateReportShareLinkFormData) =>
      fetchJson<ReportShareLinkListItem>(`/api/reports/${artifactId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report_share_links", artifactId] });
    },
  });
}

export function useRevokeReportShareLink(artifactId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (shareId: string) =>
      fetchJson<ReportShareLinkListItem>(`/api/reports/${artifactId}/share/${shareId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report_share_links", artifactId] });
    },
  });
}