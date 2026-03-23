import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "@/hooks/api";
import type {
  AnalyticsClusterDecisionRequest,
  AnalyticsClusterDecisionResponse,
  AnalyticsJobPhase,
  AnalyticsJobStatus,
  AnalyticsJobStatusResponse,
  AnalyticsJobTriggerResponse,
  ConsultationAnalyticsResponse,
  RoundAnalyticsJobsResponse,
  RoundAnalyticsResponse,
} from "@/types/analytics";

export const ANALYTICS_JOB_POLL_INTERVAL_MS = 3_000;

const ACTIVE_ANALYTICS_JOB_PHASES = new Set<AnalyticsJobPhase>([
  "queued",
  "extracting",
  "embedding",
  "clustering",
  "syncing",
]);

export const analyticsQueryKeys = {
  consultation: (consultationId: string) => ["analytics", "consultation", consultationId] as const,
  consultationJob: (consultationId: string) =>
    ["analytics", "consultation", consultationId, "job"] as const,
  consultationGroup: (consultationGroupId: string) =>
    ["analytics", "consultation_group", consultationGroupId] as const,
  consultationGroupJobs: (consultationGroupId: string) =>
    ["analytics", "consultation_group", consultationGroupId, "jobs"] as const,
};

export function isAnalyticsJobActive(jobStatus: AnalyticsJobStatus | null | undefined) {
  return Boolean(jobStatus && ACTIVE_ANALYTICS_JOB_PHASES.has(jobStatus.phase));
}

export function isRoundAnalyticsPollingEnabled(data?: RoundAnalyticsJobsResponse) {
  return Boolean(data?.data.some((job) => isAnalyticsJobActive(job.jobStatus)));
}

export function isConsultationAnalyticsPollingEnabled(data?: AnalyticsJobStatusResponse) {
  return isAnalyticsJobActive(data?.data ?? null);
}

export function useConsultationAnalytics(consultationId: string) {
  return useQuery({
    queryKey: analyticsQueryKeys.consultation(consultationId),
    queryFn: () => fetchJson<ConsultationAnalyticsResponse>(`/api/client/analytics/consultations/${consultationId}`),
    enabled: Boolean(consultationId),
    retry: false,
  });
}

export function useConsultationAnalyticsJobStatus(consultationId: string) {
  return useQuery({
    queryKey: analyticsQueryKeys.consultationJob(consultationId),
    queryFn: () => fetchJson<AnalyticsJobStatusResponse>(`/api/client/analytics/consultations/${consultationId}/jobs`),
    enabled: Boolean(consultationId),
    retry: false,
    refetchInterval: (query) => {
      const data = query.state.data as AnalyticsJobStatusResponse | undefined;
      if (!data) {
        return ANALYTICS_JOB_POLL_INTERVAL_MS;
      }

      return isConsultationAnalyticsPollingEnabled(data) ? ANALYTICS_JOB_POLL_INTERVAL_MS : false;
    },
  });
}

export function useConsultationGroupAnalytics(consultationGroupId: string) {
  return useQuery({
    queryKey: analyticsQueryKeys.consultationGroup(consultationGroupId),
    queryFn: () =>
      fetchJson<RoundAnalyticsResponse>(
        `/api/client/analytics/consultation-groups/${consultationGroupId}`
      ),
    enabled: Boolean(consultationGroupId),
    retry: false,
  });
}

export function useRoundAnalytics(consultationGroupId: string) {
  return useConsultationGroupAnalytics(consultationGroupId);
}

export function useConsultationGroupAnalyticsJobs(consultationGroupId: string) {
  return useQuery({
    queryKey: analyticsQueryKeys.consultationGroupJobs(consultationGroupId),
    queryFn: () =>
      fetchJson<RoundAnalyticsJobsResponse>(
        `/api/client/analytics/consultation-groups/${consultationGroupId}/jobs`
      ),
    enabled: Boolean(consultationGroupId),
    retry: false,
    refetchInterval: (query) => {
      const data = query.state.data as RoundAnalyticsJobsResponse | undefined;
      if (!data) {
        return ANALYTICS_JOB_POLL_INTERVAL_MS;
      }

      return isRoundAnalyticsPollingEnabled(data) ? ANALYTICS_JOB_POLL_INTERVAL_MS : false;
    },
  });
}

export function useRoundAnalyticsJobs(consultationGroupId: string) {
  return useConsultationGroupAnalyticsJobs(consultationGroupId);
}

export function useTriggerConsultationGroupAnalyticsJobs(consultationGroupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      fetchJson<{ jobCount: number }>(
        `/api/client/analytics/consultation-groups/${consultationGroupId}/jobs`,
        {
        method: "POST",
        }
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: analyticsQueryKeys.consultationGroup(consultationGroupId) }),
        queryClient.invalidateQueries({ queryKey: analyticsQueryKeys.consultationGroupJobs(consultationGroupId) }),
      ]);
    },
  });
}

export function useTriggerRoundAnalyticsJobs(consultationGroupId: string) {
  return useTriggerConsultationGroupAnalyticsJobs(consultationGroupId);
}

export function useClearAndRetriggerConsultationGroupJobs(consultationGroupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await fetchJson<{ clearedCount: number }>(
        `/api/client/analytics/consultation-groups/${consultationGroupId}/jobs`,
        { method: "DELETE" }
      );
      return fetchJson<{ jobCount: number }>(
        `/api/client/analytics/consultation-groups/${consultationGroupId}/jobs`,
        { method: "POST" }
      );
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: analyticsQueryKeys.consultationGroup(consultationGroupId) }),
        queryClient.invalidateQueries({ queryKey: analyticsQueryKeys.consultationGroupJobs(consultationGroupId) }),
      ]);
    },
  });
}

export function useTriggerConsultationAnalyticsJob(consultationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (roundId?: string | null) =>
      fetchJson<AnalyticsJobTriggerResponse>(`/api/client/analytics/consultations/${consultationId}/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(roundId ? { roundId } : {}),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: analyticsQueryKeys.consultation(consultationId) }),
        queryClient.invalidateQueries({ queryKey: analyticsQueryKeys.consultationJob(consultationId) }),
      ]);
    },
  });
}

export function useConsultationGroupAnalyticsClusterDecision(consultationGroupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ clusterId, ...payload }: AnalyticsClusterDecisionRequest & { clusterId: number }) =>
      fetchJson<AnalyticsClusterDecisionResponse>(
        `/api/client/analytics/consultation-groups/${consultationGroupId}/clusters/${clusterId}/decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: analyticsQueryKeys.consultationGroup(consultationGroupId) }),
        queryClient.invalidateQueries({ queryKey: ["consultation_rounds", consultationGroupId, "detail"] }),
      ]);
    },
  });
}

export function useAnalyticsClusterDecision(consultationGroupId: string) {
  return useConsultationGroupAnalyticsClusterDecision(consultationGroupId);
}