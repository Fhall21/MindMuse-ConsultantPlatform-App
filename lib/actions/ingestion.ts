"use server";

// Ingestion actions — stubs pending Agent 1 (storage) + Agent 2 (transcription service)
//
// Contract for Agent 2's transcription endpoint:
//   POST /transcribe { consultation_id, storage_path } → { job_id }
//   GET  /transcribe/{job_id}                          → TranscriptionJob
//
// Contract for Agent 1's storage:
//   uploadAudioToStorage({ consultationId, fileName, fileBuffer }) → { storagePath }

export type TranscriptionJobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed";

export interface TranscriptionJob {
  jobId: string;
  status: TranscriptionJobStatus;
  transcript: string | null;
  updatedAt: string;
  errorMessage: string | null;
}

export async function uploadAudioForTranscription(_params: {
  consultationId: string;
  fileName: string;
  fileType: string;
  /** base64-encoded file content */
  fileBase64: string;
}): Promise<{ jobId: string }> {
  // TODO: Agent 1 — upload audio file to Supabase Storage, get storagePath
  // TODO: Agent 2 — POST /transcribe { consultation_id, storage_path } → { job_id }
  throw new Error(
    "uploadAudioForTranscription: not yet implemented — requires Agent 1 storage + Agent 2 transcription endpoint"
  );
}

export async function getTranscriptionJob(
  _jobId: string
): Promise<TranscriptionJob> {
  // TODO: Agent 2 — GET /transcribe/{jobId} → TranscriptionJob
  throw new Error(
    "getTranscriptionJob: not yet implemented — requires Agent 2 transcription endpoint"
  );
}
