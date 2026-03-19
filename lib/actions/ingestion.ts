"use server";

import { createClient } from "@/lib/supabase/server";
import { AUDIT_ACTIONS } from "./audit-actions";
import { emitAuditEvent } from "./audit";
import type {
  TranscriptionJob as DatabaseTranscriptionJob,
  OcrJob as DatabaseOcrJob,
  IngestionArtifact as DatabaseIngestionArtifact,
  IngestionStatus,
  IngestionArtifactType,
} from "@/types/db";

export type TranscriptionJobStatus = IngestionStatus;

export interface TranscriptionJob {
  jobId: string;
  status: TranscriptionJobStatus;
  transcript: string | null;
  updatedAt: string;
  errorMessage: string | null;
}

function mapTranscriptionJob(job: DatabaseTranscriptionJob): TranscriptionJob {
  return {
    jobId: job.id,
    status: job.status,
    transcript: job.transcript_text,
    updatedAt: job.updated_at,
    errorMessage: job.error_message,
  };
}

function mapOcrJob(job: DatabaseOcrJob): DatabaseOcrJob {
  return job;
}

function buildAudioFileKey(consultationId: string, fileName: string) {
  return `audio/${consultationId}/${Date.now()}-${fileName}`;
}

export async function uploadAudioForTranscription(params: {
  consultationId: string;
  fileName: string;
  fileType: string;
  /** base64-encoded file content */
  fileBase64: string;
}): Promise<{ jobId: string }> {
  const audioFileKey = buildAudioFileKey(params.consultationId, params.fileName);
  const jobId = await createTranscriptionJob({
    consultationId: params.consultationId,
    audioFileKey,
  });

  return { jobId };
}

export async function getTranscriptionJob(jobId: string): Promise<TranscriptionJob> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("transcription_jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (error) throw error;

  return mapTranscriptionJob(data as DatabaseTranscriptionJob);
}

export async function getTranscriptionJobsForConsultation(
  consultationId: string
): Promise<DatabaseTranscriptionJob[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("transcription_jobs")
    .select("*")
    .eq("consultation_id", consultationId)
    .order("requested_at", { ascending: false });

  if (error) throw error;

  return (data || []).map((job) => job as DatabaseTranscriptionJob);
}

interface CreateTranscriptionJobParams {
  consultationId: string;
  audioFileKey: string;
}

export async function createTranscriptionJob({
  consultationId,
  audioFileKey,
}: CreateTranscriptionJobParams): Promise<string> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("transcription_jobs")
    .insert({
      consultation_id: consultationId,
      audio_file_key: audioFileKey,
      status: "queued",
    })
    .select("id")
    .single();

  if (error) throw error;

  await emitAuditEvent({
    consultationId,
    action: AUDIT_ACTIONS.AUDIO_UPLOADED,
    entityType: "transcription_job",
    entityId: data.id,
    metadata: { audioFileKey },
  });

  await emitAuditEvent({
    consultationId,
    action: AUDIT_ACTIONS.AUDIO_TRANSCRIPTION_REQUESTED,
    entityType: "transcription_job",
    entityId: data.id,
    metadata: { audioFileKey },
  });

  return data.id;
}

interface UpdateTranscriptionJobParams {
  jobId: string;
  consultationId?: string;
  status: IngestionStatus;
  transcriptText?: string;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
}

export async function updateTranscriptionJob({
  jobId,
  consultationId,
  status,
  transcriptText,
  errorMessage,
  startedAt,
  completedAt,
}: UpdateTranscriptionJobParams): Promise<DatabaseTranscriptionJob> {
  const supabase = await createClient();

  const updatePayload: Record<string, string | null> = { status };
  if (transcriptText) updatePayload.transcript_text = transcriptText;
  if (errorMessage) updatePayload.error_message = errorMessage;
  if (startedAt) updatePayload.started_at = startedAt;
  if (completedAt) updatePayload.completed_at = completedAt;

  const { data: updated, error: updateError } = await supabase
    .from("transcription_jobs")
    .update(updatePayload)
    .eq("id", jobId)
    .select()
    .single();

  if (updateError) throw updateError;

  const resolvedConsultationId = consultationId ?? updated.consultation_id;

  let auditAction = "";
  let metadata: Record<string, string | number | null | undefined> = {
    transcriptLength: transcriptText?.length ?? 0,
  };

  if (status === "processing") {
    auditAction = AUDIT_ACTIONS.AUDIO_TRANSCRIPTION_REQUESTED;
  } else if (status === "completed") {
    auditAction = AUDIT_ACTIONS.AUDIO_TRANSCRIPTION_COMPLETED;
  } else if (status === "failed") {
    auditAction = AUDIT_ACTIONS.AUDIO_TRANSCRIPTION_FAILED;
    metadata = { error: errorMessage || "" };
  }

  if (auditAction) {
    await emitAuditEvent({
      consultationId: resolvedConsultationId,
      action: auditAction,
      entityType: "transcription_job",
      entityId: jobId,
      metadata,
    });
  }

  return updated as DatabaseTranscriptionJob;
}

interface GetTranscriptionJobTimelineParams {
  consultationId: string;
}

export async function getTranscriptionJobTimeline({
  consultationId,
}: GetTranscriptionJobTimelineParams): Promise<DatabaseTranscriptionJob[]> {
  return getTranscriptionJobsForConsultation(consultationId);
}

interface CreateOcrJobParams {
  consultationId: string;
  imageFileKey: string;
}

export async function createOcrJob({
  consultationId,
  imageFileKey,
}: CreateOcrJobParams): Promise<string> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ocr_jobs")
    .insert({
      consultation_id: consultationId,
      image_file_key: imageFileKey,
      status: "queued",
    })
    .select("id")
    .single();

  if (error) throw error;

  await emitAuditEvent({
    consultationId,
    action: AUDIT_ACTIONS.OCR_UPLOADED,
    entityType: "ocr_job",
    entityId: data.id,
    metadata: { imageFileKey },
  });

  await emitAuditEvent({
    consultationId,
    action: AUDIT_ACTIONS.OCR_EXTRACTION_REQUESTED,
    entityType: "ocr_job",
    entityId: data.id,
    metadata: { imageFileKey },
  });

  return data.id;
}

interface UpdateOcrJobParams {
  jobId: string;
  consultationId?: string;
  status: IngestionStatus;
  extractedText?: string;
  confidenceScore?: number;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
}

export async function updateOcrJob({
  jobId,
  consultationId,
  status,
  extractedText,
  confidenceScore,
  errorMessage,
  startedAt,
  completedAt,
}: UpdateOcrJobParams): Promise<DatabaseOcrJob> {
  const supabase = await createClient();

  const updatePayload: Record<string, string | number | null> = { status };
  if (extractedText) updatePayload.extracted_text = extractedText;
  if (confidenceScore !== undefined) updatePayload.confidence_score = confidenceScore;
  if (errorMessage) updatePayload.error_message = errorMessage;
  if (startedAt) updatePayload.started_at = startedAt;
  if (completedAt) updatePayload.completed_at = completedAt;

  const { data: updated, error: updateError } = await supabase
    .from("ocr_jobs")
    .update(updatePayload)
    .eq("id", jobId)
    .select()
    .single();

  if (updateError) throw updateError;

  const resolvedConsultationId = consultationId ?? updated.consultation_id;

  let auditAction = "";
  let metadata: Record<string, string | number | null | undefined> = {
    extractedTextLength: extractedText?.length || 0,
    confidenceScore,
  };

  if (status === "processing") {
    auditAction = AUDIT_ACTIONS.OCR_EXTRACTION_REQUESTED;
  } else if (status === "completed") {
    auditAction = AUDIT_ACTIONS.OCR_EXTRACTION_COMPLETED;
  } else if (status === "failed") {
    auditAction = AUDIT_ACTIONS.OCR_EXTRACTION_FAILED;
    metadata = { error: errorMessage || "" };
  }

  if (auditAction) {
    await emitAuditEvent({
      consultationId: resolvedConsultationId,
      action: auditAction,
      entityType: "ocr_job",
      entityId: jobId,
      metadata,
    });
  }

  return updated as DatabaseOcrJob;
}

export async function getOcrJobsForConsultation(
  consultationId: string
): Promise<DatabaseOcrJob[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ocr_jobs")
    .select("*")
    .eq("consultation_id", consultationId)
    .order("requested_at", { ascending: false });

  if (error) throw error;

  return (data || []).map((job) => mapOcrJob(job as DatabaseOcrJob));
}

export async function getOcrJob(jobId: string): Promise<DatabaseOcrJob> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ocr_jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (error) throw error;

  return mapOcrJob(data as DatabaseOcrJob);
}

interface GetOcrJobTimelineParams {
  consultationId: string;
}

export async function getOcrJobTimeline({
  consultationId,
}: GetOcrJobTimelineParams): Promise<DatabaseOcrJob[]> {
  return getOcrJobsForConsultation(consultationId);
}

interface CreateIngestionArtifactParams {
  consultationId: string;
  artifactType: IngestionArtifactType;
  sourceFileKey: string;
  metadata?: Record<string, unknown>;
}

export async function createIngestionArtifact({
  consultationId,
  artifactType,
  sourceFileKey,
  metadata,
}: CreateIngestionArtifactParams): Promise<string> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ingestion_artifacts")
    .insert({
      consultation_id: consultationId,
      artifact_type: artifactType,
      source_file_key: sourceFileKey,
      metadata: metadata || null,
    })
    .select("id")
    .single();

  if (error) throw error;

  let auditAction = "";
  if (artifactType === "transcript_file") {
    auditAction = AUDIT_ACTIONS.TRANSCRIPT_FILE_UPLOADED;
  } else if (artifactType === "transcript_paste") {
    auditAction = AUDIT_ACTIONS.TRANSCRIPT_PARSED;
  } else if (artifactType === "audio") {
    auditAction = AUDIT_ACTIONS.AUDIO_UPLOADED;
  } else if (artifactType === "ocr_image") {
    auditAction = AUDIT_ACTIONS.OCR_UPLOADED;
  }

  if (auditAction) {
    await emitAuditEvent({
      consultationId,
      action: auditAction,
      entityType: "ingestion_artifact",
      entityId: data.id,
      metadata: { artifactType, ...metadata },
    });
  }

  return data.id;
}

interface UpdateIngestionArtifactParams {
  artifactId: string;
  consultationId?: string;
  accepted?: boolean;
  notes?: string;
}

export async function updateIngestionArtifact({
  artifactId,
  consultationId,
  accepted,
  notes,
}: UpdateIngestionArtifactParams): Promise<DatabaseIngestionArtifact> {
  const supabase = await createClient();

  const updatePayload: Record<string, boolean | string> = {};
  if (accepted !== undefined) updatePayload.accepted = accepted;
  if (notes !== undefined) updatePayload.notes = notes;

  const { data: updated, error: updateError } = await supabase
    .from("ingestion_artifacts")
    .update(updatePayload)
    .eq("id", artifactId)
    .select()
    .single();

  if (updateError) throw updateError;

  const resolvedConsultationId = consultationId ?? updated.consultation_id;

  if (accepted !== undefined) {
    const auditAction = accepted
      ? AUDIT_ACTIONS.OCR_REVIEW_ACCEPTED
      : AUDIT_ACTIONS.OCR_REVIEW_REJECTED;

    await emitAuditEvent({
      consultationId: resolvedConsultationId,
      action: auditAction,
      entityType: "ingestion_artifact",
      entityId: artifactId,
      metadata: { accepted, notes: notes || "" },
    });
  }

  return updated as DatabaseIngestionArtifact;
}

interface GetIngestionArtifactTimelineParams {
  consultationId: string;
}

export async function getIngestionArtifactTimeline({
  consultationId,
}: GetIngestionArtifactTimelineParams): Promise<DatabaseIngestionArtifact[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ingestion_artifacts")
    .select("*")
    .eq("consultation_id", consultationId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as DatabaseIngestionArtifact[];
}

export async function getIngestionArtifactsForConsultation(
  consultationId: string
): Promise<DatabaseIngestionArtifact[]> {
  return getIngestionArtifactTimeline({ consultationId });
}

export async function getIngestionArtifactById(
  artifactId: string
): Promise<DatabaseIngestionArtifact> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ingestion_artifacts")
    .select("*")
    .eq("id", artifactId)
    .single();

  if (error) throw error;

  return data as DatabaseIngestionArtifact;
}

export async function getIngestionArtifactsByType(
  consultationId: string,
  artifactType: string
): Promise<DatabaseIngestionArtifact[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ingestion_artifacts")
    .select("*")
    .eq("consultation_id", consultationId)
    .eq("artifact_type", artifactType)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data || []) as DatabaseIngestionArtifact[];
}
