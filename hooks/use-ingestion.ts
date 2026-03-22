import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getIngestionArtifactById,
  getIngestionArtifactsByType,
  getIngestionArtifactsForMeeting,
  getOcrJob,
  getOcrJobsForMeeting,
  getTranscriptionJob,
  getTranscriptionJobsForMeeting,
} from "@/lib/actions/ingestion";
import type {
  TranscriptionJob,
  OcrJob,
} from "@/types/db";

const ACTIVE_STATUSES = new Set(["queued", "processing"]);

// ============================================================
// Transcription Jobs Hooks
// ============================================================

/**
 * Fetch all transcription jobs for a consultation
 * Updates in real-time as jobs are created or status changes
 * @param consultationId - The consultation ID to fetch jobs for
 */
export function useMeetingTranscriptionJobs(meetingId: string) {
  return useQuery({
    queryKey: ["transcription_jobs", "meeting", meetingId],
    queryFn: () => getTranscriptionJobsForMeeting(meetingId),
    enabled: !!meetingId,
    refetchInterval: (query) => {
      const jobs = query.state.data as TranscriptionJob[] | undefined;
      const latestJob = jobs?.[0];
      return latestJob && ACTIVE_STATUSES.has(latestJob.status) ? 3_000 : false;
    },
  });
}

export const useTranscriptionJobs = useMeetingTranscriptionJobs;

/**
 * Fetch a single transcription job by ID
 * @param jobId - The job ID to fetch
 */
export function useTranscriptionJob(jobId: string) {
  return useQuery({
    queryKey: ["transcription_jobs", jobId],
    queryFn: async () => {
      const data = await getTranscriptionJob(jobId);
      return {
        id: data.jobId,
        meeting_id: "",
        audio_file_key: "",
        status: data.status,
        transcript_text: data.transcript,
        error_message: data.errorMessage,
        requested_at: data.updatedAt,
        started_at: null,
        completed_at: null,
        created_at: data.updatedAt,
        updated_at: data.updatedAt,
      } as TranscriptionJob;
    },
    enabled: !!jobId,
    refetchInterval: (query) => {
      const job = query.state.data as TranscriptionJob | undefined;
      return job && ACTIVE_STATUSES.has(job.status) ? 3_000 : false;
    },
  });
}

// ============================================================
// OCR Jobs Hooks
// ============================================================

/**
 * Fetch all OCR jobs for a consultation
 * @param consultationId - The consultation ID to fetch jobs for
 */
export function useMeetingOcrJobs(meetingId: string) {
  return useQuery({
    queryKey: ["ocr_jobs", "meeting", meetingId],
    queryFn: () => getOcrJobsForMeeting(meetingId),
    enabled: !!meetingId,
    refetchInterval: (query) => {
      const jobs = query.state.data as OcrJob[] | undefined;
      const latestJob = jobs?.[0];
      return latestJob && ACTIVE_STATUSES.has(latestJob.status) ? 3_000 : false;
    },
  });
}

export const useOcrJobs = useMeetingOcrJobs;

/**
 * Fetch a single OCR job by ID
 * @param jobId - The job ID to fetch
 */
export function useOcrJob(jobId: string) {
  return useQuery({
    queryKey: ["ocr_jobs", jobId],
    queryFn: () => getOcrJob(jobId),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const job = query.state.data as OcrJob | undefined;
      return job && ACTIVE_STATUSES.has(job.status) ? 3_000 : false;
    },
  });
}

// ============================================================
// Ingestion Artifacts Hooks
// ============================================================

/**
 * Fetch all ingestion artifacts for a consultation
 * @param consultationId - The consultation ID to fetch artifacts for
 */
export function useMeetingIngestionArtifacts(meetingId: string) {
  return useQuery({
    queryKey: ["ingestion_artifacts", "meeting", meetingId],
    queryFn: () => getIngestionArtifactsForMeeting(meetingId),
    enabled: !!meetingId,
  });
}

export const useIngestionArtifacts = useMeetingIngestionArtifacts;

/**
 * Fetch a single ingestion artifact by ID
 * @param artifactId - The artifact ID to fetch
 */
export function useIngestionArtifact(artifactId: string) {
  return useQuery({
    queryKey: ["ingestion_artifacts", artifactId],
    queryFn: () => getIngestionArtifactById(artifactId),
    enabled: !!artifactId,
  });
}

/**
 * Fetch ingestion artifacts of a specific type for a consultation
 * @param consultationId - The consultation ID
 * @param artifactType - The type of artifacts to fetch (e.g., 'ocr_image', 'audio')
 */
export function useIngestionArtifactsByType(
  meetingId: string,
  artifactType: string
) {
  return useQuery({
    queryKey: ["ingestion_artifacts", "meeting", meetingId, artifactType],
    queryFn: () => getIngestionArtifactsByType(meetingId, artifactType),
    enabled: !!meetingId && !!artifactType,
  });
}

// ============================================================
// Cache Invalidation Helpers
// ============================================================

/**
 * Hook to provide cache invalidation utilities
 * Use to manually refresh queries after mutations
 * Example: invalidateIngestionCaches("consultation-123")
 */
export function useInvalidateIngestionCaches() {
  const queryClient = useQueryClient();

  return {
    invalidateAllForMeeting: (meetingId: string) => {
      queryClient.invalidateQueries({
        queryKey: ["transcription_jobs", "meeting", meetingId],
      });
      queryClient.invalidateQueries({
        queryKey: ["ocr_jobs", "meeting", meetingId],
      });
      queryClient.invalidateQueries({
        queryKey: ["ingestion_artifacts", "meeting", meetingId],
      });
    },
    invalidateAllForConsultation: (consultationId: string) => {
      queryClient.invalidateQueries({
        queryKey: ["transcription_jobs", "meeting", consultationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["ocr_jobs", "meeting", consultationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["ingestion_artifacts", "meeting", consultationId],
      });
    },
    invalidateTranscriptionJobs: (meetingId: string) => {
      queryClient.invalidateQueries({
        queryKey: ["transcription_jobs", "meeting", meetingId],
      });
    },
    invalidateOcrJobs: (meetingId: string) => {
      queryClient.invalidateQueries({
        queryKey: ["ocr_jobs", "meeting", meetingId],
      });
    },
    invalidateIngestionArtifacts: (meetingId: string) => {
      queryClient.invalidateQueries({
        queryKey: ["ingestion_artifacts", "meeting", meetingId],
      });
    },
  };
}
