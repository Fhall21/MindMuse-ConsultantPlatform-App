"use server";

import { createClient } from "@/lib/supabase/server";
import { AUDIT_ACTIONS } from "./audit-actions";
import { emitAuditEvent } from "./audit";
import type {
  TranscriptionJob,
  OcrJob,
  IngestionArtifact,
  IngestionStatus,
  IngestionArtifactType,
} from "@/types/db";

// ============================================================
// Transcription Jobs
// ============================================================

interface CreateTranscriptionJobParams {
  consultationId: string;
  audioFileKey: string;
}

/**
 * Create a new transcription job and emit audio.uploaded + audio.transcription_requested events
 */
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

  // Emit two events: file uploaded, and job requested
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

/**
 * Update a transcription job status and emit appropriate audit event
 */
export async function updateTranscriptionJob({
  jobId,
  consultationId,
  status,
  transcriptText,
  errorMessage,
  startedAt,
  completedAt,
}: UpdateTranscriptionJobParams): Promise<TranscriptionJob> {
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

  // Determine consultation ID if not provided
  let consulId = consultationId;
  if (!consulId) {
    consulId = updated.consultation_id;
  }

  // Emit appropriate audit event based on status transition
  let auditAction = "";
  let metadata: Record<string, string | number | null> = { transcriptLength: transcriptText?.length || 0 };

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
      consultationId: consulId,
      action: auditAction,
      entityType: "transcription_job",
      entityId: jobId,
      metadata,
    });
  }

  return updated as TranscriptionJob;
}

interface GetTranscriptionJobTimelineParams {
  consultationId: string;
}

/**
 * Fetch all transcription jobs for a consultation, ordered by recency
 */
export async function getTranscriptionJobTimeline({
  consultationId,
}: GetTranscriptionJobTimelineParams): Promise<TranscriptionJob[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("transcription_jobs")
    .select("*")
    .eq("consultation_id", consultationId)
    .order("requested_at", { ascending: false });

  if (error) throw error;
  return (data || []) as TranscriptionJob[];
}

// ============================================================
// OCR Jobs
// ============================================================

interface CreateOcrJobParams {
  consultationId: string;
  imageFileKey: string;
}

/**
 * Create a new OCR job and emit ocr.uploaded + ocr.extraction_requested events
 */
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

  // Emit two events: file uploaded, and job requested
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

/**
 * Update an OCR job status and emit appropriate audit event
 */
export async function updateOcrJob({
  jobId,
  consultationId,
  status,
  extractedText,
  confidenceScore,
  errorMessage,
  startedAt,
  completedAt,
}: UpdateOcrJobParams): Promise<OcrJob> {
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

  // Determine consultation ID if not provided
  let consulId = consultationId;
  if (!consulId) {
    consulId = updated.consultation_id;
  }

  // Emit appropriate audit event based on status transition
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
      consultationId: consulId,
      action: auditAction,
      entityType: "ocr_job",
      entityId: jobId,
      metadata,
    });
  }

  return updated as OcrJob;
}

interface GetOcrJobTimelineParams {
  consultationId: string;
}

/**
 * Fetch all OCR jobs for a consultation, ordered by recency
 */
export async function getOcrJobTimeline({
  consultationId,
}: GetOcrJobTimelineParams): Promise<OcrJob[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ocr_jobs")
    .select("*")
    .eq("consultation_id", consultationId)
    .order("requested_at", { ascending: false });

  if (error) throw error;
  return (data || []) as OcrJob[];
}

// ============================================================
// Ingestion Artifacts
// ============================================================

interface CreateIngestionArtifactParams {
  consultationId: string;
  artifactType: IngestionArtifactType;
  sourceFileKey: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create a new ingestion artifact, emitting an appropriate audit event based on artifact type
 */
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

  // Map artifact_type to appropriate audit action
  let auditAction = "";
  if (artifactType === "transcript_file") {
    auditAction = AUDIT_ACTIONS.TRANSCRIPT_FILE_UPLOADED;
  } else if (artifactType === "transcript_paste") {
    auditAction = AUDIT_ACTIONS.TRANSCRIPT_PARSED;
  } else if (artifactType === "audio") {
    // audio artifacts are tracked separately via transcription_jobs
    auditAction = AUDIT_ACTIONS.AUDIO_UPLOADED;
  } else if (artifactType === "ocr_image") {
    auditAction = AUDIT_ACTIONS.OCR_UPLOADED;
  } else if (artifactType === "clarification_response") {
    // clarification_response is tracked implicitly via acceptance events
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

/**
 * Update an ingestion artifact (e.g., accepting or rejecting OCR review)
 * Emits review_accepted or review_rejected event if acceptance state changes
 */
export async function updateIngestionArtifact({
  artifactId,
  consultationId,
  accepted,
  notes,
}: UpdateIngestionArtifactParams): Promise<IngestionArtifact> {
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

  // Determine consultation ID if not provided
  let consulId = consultationId;
  if (!consulId) {
    consulId = updated.consultation_id;
  }

  // Emit appropriate audit event if acceptance state was updated
  if (accepted !== undefined) {
    const auditAction = accepted
      ? AUDIT_ACTIONS.OCR_REVIEW_ACCEPTED
      : AUDIT_ACTIONS.OCR_REVIEW_REJECTED;

    await emitAuditEvent({
      consultationId: consulId,
      action: auditAction,
      entityType: "ingestion_artifact",
      entityId: artifactId,
      metadata: { accepted, notes: notes || "" },
    });
  }

  return updated as IngestionArtifact;
}

interface GetIngestionArtifactTimelineParams {
  consultationId: string;
}

/**
 * Fetch all ingestion artifacts for a consultation, ordered by recency
 */
export async function getIngestionArtifactTimeline({
  consultationId,
}: GetIngestionArtifactTimelineParams): Promise<IngestionArtifact[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ingestion_artifacts")
    .select("*")
    .eq("consultation_id", consultationId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as IngestionArtifact[];
}
