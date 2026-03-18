import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type {
  TranscriptionJob,
  OcrJob,
  IngestionArtifact,
} from "@/types/db";

// ============================================================
// Transcription Jobs Hooks
// ============================================================

/**
 * Fetch all transcription jobs for a consultation
 * Updates in real-time as jobs are created or status changes
 * @param consultationId - The consultation ID to fetch jobs for
 */
export function useTranscriptionJobs(consultationId: string) {
  return useQuery({
    queryKey: ["transcription_jobs", consultationId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("transcription_jobs")
        .select("*")
        .eq("consultation_id", consultationId)
        .order("requested_at", { ascending: false });

      if (error) throw error;
      return (data || []) as TranscriptionJob[];
    },
    enabled: !!consultationId,
  });
}

/**
 * Fetch a single transcription job by ID
 * @param jobId - The job ID to fetch
 */
export function useTranscriptionJob(jobId: string) {
  return useQuery({
    queryKey: ["transcription_jobs", jobId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("transcription_jobs")
        .select("*")
        .eq("id", jobId)
        .single();

      if (error) throw error;
      return data as TranscriptionJob;
    },
    enabled: !!jobId,
    // TODO: Enable Supabase Realtime subscription here for live status updates
    // For now, use default staleTime/refetch intervals
  });
}

// ============================================================
// OCR Jobs Hooks
// ============================================================

/**
 * Fetch all OCR jobs for a consultation
 * @param consultationId - The consultation ID to fetch jobs for
 */
export function useOcrJobs(consultationId: string) {
  return useQuery({
    queryKey: ["ocr_jobs", consultationId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("ocr_jobs")
        .select("*")
        .eq("consultation_id", consultationId)
        .order("requested_at", { ascending: false });

      if (error) throw error;
      return (data || []) as OcrJob[];
    },
    enabled: !!consultationId,
  });
}

/**
 * Fetch a single OCR job by ID
 * @param jobId - The job ID to fetch
 */
export function useOcrJob(jobId: string) {
  return useQuery({
    queryKey: ["ocr_jobs", jobId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("ocr_jobs")
        .select("*")
        .eq("id", jobId)
        .single();

      if (error) throw error;
      return data as OcrJob;
    },
    enabled: !!jobId,
    // TODO: Enable Supabase Realtime subscription here for live status updates
  });
}

// ============================================================
// Ingestion Artifacts Hooks
// ============================================================

/**
 * Fetch all ingestion artifacts for a consultation
 * @param consultationId - The consultation ID to fetch artifacts for
 */
export function useIngestionArtifacts(consultationId: string) {
  return useQuery({
    queryKey: ["ingestion_artifacts", consultationId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("ingestion_artifacts")
        .select("*")
        .eq("consultation_id", consultationId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as IngestionArtifact[];
    },
    enabled: !!consultationId,
  });
}

/**
 * Fetch a single ingestion artifact by ID
 * @param artifactId - The artifact ID to fetch
 */
export function useIngestionArtifact(artifactId: string) {
  return useQuery({
    queryKey: ["ingestion_artifacts", artifactId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("ingestion_artifacts")
        .select("*")
        .eq("id", artifactId)
        .single();

      if (error) throw error;
      return data as IngestionArtifact;
    },
    enabled: !!artifactId,
  });
}

/**
 * Fetch ingestion artifacts of a specific type for a consultation
 * @param consultationId - The consultation ID
 * @param artifactType - The type of artifacts to fetch (e.g., 'ocr_image', 'audio')
 */
export function useIngestionArtifactsByType(
  consultationId: string,
  artifactType: string
) {
  return useQuery({
    queryKey: ["ingestion_artifacts", consultationId, artifactType],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("ingestion_artifacts")
        .select("*")
        .eq("consultation_id", consultationId)
        .eq("artifact_type", artifactType)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as IngestionArtifact[];
    },
    enabled: !!consultationId && !!artifactType,
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
    invalidateAllForConsultation: (consultationId: string) => {
      queryClient.invalidateQueries({
        queryKey: ["transcription_jobs", consultationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["ocr_jobs", consultationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["ingestion_artifacts", consultationId],
      });
    },
    invalidateTranscriptionJobs: (consultationId: string) => {
      queryClient.invalidateQueries({
        queryKey: ["transcription_jobs", consultationId],
      });
    },
    invalidateOcrJobs: (consultationId: string) => {
      queryClient.invalidateQueries({
        queryKey: ["ocr_jobs", consultationId],
      });
    },
    invalidateIngestionArtifacts: (consultationId: string) => {
      queryClient.invalidateQueries({
        queryKey: ["ingestion_artifacts", consultationId],
      });
    },
  };
}
