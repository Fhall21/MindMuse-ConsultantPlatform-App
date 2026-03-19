import { useQuery } from "@tanstack/react-query";
import { getTranscriptionJob, type TranscriptionJob } from "@/lib/actions/ingestion";

const ACTIVE_STATUSES = new Set<string>(["queued", "processing"]);

/**
 * Polls transcription job status every 3s while active, stops when completed/failed.
 * Returns undefined when no jobId is provided.
 */
export function useTranscriptionStatus(jobId: string | null) {
  return useQuery({
    queryKey: ["transcription-job", jobId],
    queryFn: () => getTranscriptionJob(jobId!),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data as TranscriptionJob | undefined;
      if (!data) return 3_000;
      return ACTIVE_STATUSES.has(data.status) ? 3_000 : false;
    },
    retry: false,
  });
}
