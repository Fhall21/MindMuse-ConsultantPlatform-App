"use server";

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { ingestionArtifacts, ocrJobs, transcriptionJobs } from "@/db/schema";
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

function toIsoString(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function toConfidenceScore(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function mapTranscriptionRow(row: typeof transcriptionJobs.$inferSelect): DatabaseTranscriptionJob {
  return {
    id: row.id,
    meeting_id: row.meetingId,
    audio_file_key: row.audioFileKey,
    status: row.status as DatabaseTranscriptionJob["status"],
    transcript_text: row.transcriptText,
    error_message: row.errorMessage,
    requested_at: row.requestedAt.toISOString(),
    started_at: toIsoString(row.startedAt),
    completed_at: toIsoString(row.completedAt),
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function mapOcrRow(row: typeof ocrJobs.$inferSelect): DatabaseOcrJob {
  return {
    id: row.id,
    meeting_id: row.meetingId,
    image_file_key: row.imageFileKey,
    status: row.status as DatabaseOcrJob["status"],
    extracted_text: row.extractedText,
    confidence_score: toConfidenceScore(row.confidenceScore),
    error_message: row.errorMessage,
    requested_at: row.requestedAt.toISOString(),
    started_at: toIsoString(row.startedAt),
    completed_at: toIsoString(row.completedAt),
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    batch_id: row.batchId ?? null,
    image_sequence: row.imageSequence ?? null,
  };
}

function mapIngestionArtifactRow(
  row: typeof ingestionArtifacts.$inferSelect
): DatabaseIngestionArtifact {
  return {
    id: row.id,
    meeting_id: row.meetingId,
    artifact_type: row.artifactType as DatabaseIngestionArtifact["artifact_type"],
    source_file_key: row.sourceFileKey,
    metadata: row.metadata,
    accepted: row.accepted,
    notes: row.notes,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function buildAudioFileKey(meetingId: string, fileName: string) {
  return `audio/${meetingId}/${Date.now()}-${fileName}`;
}

export async function uploadAudioForTranscription(params: {
  meetingId: string;
  fileName: string;
  fileType: string;
  /** base64-encoded file content */
  fileBase64: string;
}): Promise<{ jobId: string }> {
  const audioFileKey = buildAudioFileKey(params.meetingId, params.fileName);
  const jobId = await createTranscriptionJob({
    meetingId: params.meetingId,
    audioFileKey,
  });

  return { jobId };
}

export async function getTranscriptionJob(jobId: string): Promise<TranscriptionJob> {
  const [job] = await db
    .select()
    .from(transcriptionJobs)
    .where(eq(transcriptionJobs.id, jobId))
    .limit(1);

  if (!job) {
    throw new Error("Transcription job not found");
  }

  return mapTranscriptionJob(mapTranscriptionRow(job));
}

export async function getTranscriptionJobsForMeeting(
  meetingId: string
): Promise<DatabaseTranscriptionJob[]> {
  const rows = await db
    .select()
    .from(transcriptionJobs)
    .where(eq(transcriptionJobs.meetingId, meetingId))
    .orderBy(desc(transcriptionJobs.requestedAt));

  return rows.map(mapTranscriptionRow);
}

export const getTranscriptionJobsForConsultation = getTranscriptionJobsForMeeting;

interface CreateTranscriptionJobParams {
  meetingId: string;
  audioFileKey: string;
}

export async function createTranscriptionJob({
  meetingId,
  audioFileKey,
}: CreateTranscriptionJobParams): Promise<string> {
  const [created] = await db
    .insert(transcriptionJobs)
    .values({
      meetingId,
      audioFileKey,
      status: "queued",
    })
    .returning({ id: transcriptionJobs.id });

  await emitAuditEvent({
    consultationId: meetingId,
    action: AUDIT_ACTIONS.AUDIO_UPLOADED,
    entityType: "transcription_job",
    entityId: created.id,
    metadata: { audioFileKey },
  });

  await emitAuditEvent({
    consultationId: meetingId,
    action: AUDIT_ACTIONS.AUDIO_TRANSCRIPTION_REQUESTED,
    entityType: "transcription_job",
    entityId: created.id,
    metadata: { audioFileKey },
  });

  return created.id;
}

interface UpdateTranscriptionJobParams {
  jobId: string;
  meetingId?: string;
  status: IngestionStatus;
  transcriptText?: string;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
}

export async function updateTranscriptionJob({
  jobId,
  meetingId,
  status,
  transcriptText,
  errorMessage,
  startedAt,
  completedAt,
}: UpdateTranscriptionJobParams): Promise<DatabaseTranscriptionJob> {
  const updatePayload: Partial<typeof transcriptionJobs.$inferInsert> = {
    status,
    updatedAt: new Date(),
  };
  if (transcriptText !== undefined) updatePayload.transcriptText = transcriptText;
  if (errorMessage !== undefined) updatePayload.errorMessage = errorMessage;
  if (startedAt !== undefined) updatePayload.startedAt = new Date(startedAt);
  if (completedAt !== undefined) updatePayload.completedAt = new Date(completedAt);

  const [updated] = await db
    .update(transcriptionJobs)
    .set(updatePayload)
    .where(eq(transcriptionJobs.id, jobId))
    .returning();

  if (!updated) {
    throw new Error("Transcription job not found");
  }

  const resolvedMeetingId = meetingId ?? updated.meetingId;

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
      consultationId: resolvedMeetingId,
      action: auditAction,
      entityType: "transcription_job",
      entityId: jobId,
      metadata,
    });
  }

  return mapTranscriptionRow(updated);
}

interface GetTranscriptionJobTimelineParams {
  meetingId: string;
}

export async function getTranscriptionJobTimeline({
  meetingId,
}: GetTranscriptionJobTimelineParams): Promise<DatabaseTranscriptionJob[]> {
  return getTranscriptionJobsForMeeting(meetingId);
}

interface CreateOcrJobParams {
  meetingId: string;
  imageFileKey: string;
  /** Optional batch group ID — all pages in one multi-photo upload share this. */
  batchId?: string;
  /** 0-based page position within the batch. */
  imageSequence?: number;
}

export async function createOcrJob({
  meetingId,
  imageFileKey,
  batchId,
  imageSequence,
}: CreateOcrJobParams): Promise<string> {
  const [created] = await db
    .insert(ocrJobs)
    .values({
      meetingId,
      imageFileKey,
      status: "queued",
      batchId: batchId ?? null,
      imageSequence: imageSequence ?? null,
    })
    .returning({ id: ocrJobs.id });

  await emitAuditEvent({
    consultationId: meetingId,
    action: AUDIT_ACTIONS.OCR_UPLOADED,
    entityType: "ocr_job",
    entityId: created.id,
    metadata: { imageFileKey, batchId: batchId ?? null, imageSequence: imageSequence ?? null },
  });

  await emitAuditEvent({
    consultationId: meetingId,
    action: AUDIT_ACTIONS.OCR_EXTRACTION_REQUESTED,
    entityType: "ocr_job",
    entityId: created.id,
    metadata: { imageFileKey },
  });

  return created.id;
}

/**
 * Create one OCR job per page in a multi-photo batch.
 * All pages share a randomly-generated batchId and are assigned imageSequence
 * values matching the caller-supplied order (0-based). Each job emits its own
 * audit trail; the batch itself emits a single OCR_BATCH_CREATED event.
 * Returns { batchId, jobIds } where jobIds are ordered by imageSequence.
 */
export async function createOcrBatch({
  meetingId,
  imageFileKeys,
}: {
  meetingId: string;
  imageFileKeys: string[];
}): Promise<{ batchId: string; jobIds: string[] }> {
  if (imageFileKeys.length === 0) {
    throw new Error("createOcrBatch requires at least one image");
  }

  // Generate a UUID for the batch group. We use crypto.randomUUID() which is
  // available in the Next.js server environment.
  const batchId = crypto.randomUUID();

  const jobIds: string[] = [];
  for (let i = 0; i < imageFileKeys.length; i++) {
    const jobId = await createOcrJob({
      meetingId,
      imageFileKey: imageFileKeys[i],
      batchId,
      imageSequence: i,
    });
    jobIds.push(jobId);
  }

  await emitAuditEvent({
    consultationId: meetingId,
    action: AUDIT_ACTIONS.OCR_BATCH_CREATED,
    entityType: "ocr_batch",
    entityId: batchId,
    metadata: { pageCount: imageFileKeys.length, batchId },
  });

  return { batchId, jobIds };
}

/**
 * Return all OCR jobs that belong to a specific batch, sorted by imageSequence.
 */
export async function getOcrJobsForBatch(
  batchId: string
): Promise<DatabaseOcrJob[]> {
  const rows = await db
    .select()
    .from(ocrJobs)
    .where(eq(ocrJobs.batchId, batchId))
    .orderBy(ocrJobs.imageSequence);

  return rows.map((job) => mapOcrJob(mapOcrRow(job)));
}

interface UpdateOcrJobParams {
  jobId: string;
  meetingId?: string;
  status: IngestionStatus;
  extractedText?: string;
  confidenceScore?: number;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
}

export async function updateOcrJob({
  jobId,
  meetingId,
  status,
  extractedText,
  confidenceScore,
  errorMessage,
  startedAt,
  completedAt,
}: UpdateOcrJobParams): Promise<DatabaseOcrJob> {
  const updatePayload: Partial<typeof ocrJobs.$inferInsert> = {
    status,
    updatedAt: new Date(),
  };
  if (extractedText !== undefined) updatePayload.extractedText = extractedText;
  if (confidenceScore !== undefined) updatePayload.confidenceScore = confidenceScore.toString();
  if (errorMessage !== undefined) updatePayload.errorMessage = errorMessage;
  if (startedAt !== undefined) updatePayload.startedAt = new Date(startedAt);
  if (completedAt !== undefined) updatePayload.completedAt = new Date(completedAt);

  const [updated] = await db
    .update(ocrJobs)
    .set(updatePayload)
    .where(eq(ocrJobs.id, jobId))
    .returning();

  if (!updated) {
    throw new Error("OCR job not found");
  }

  const resolvedMeetingId = meetingId ?? updated.meetingId;

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
      consultationId: resolvedMeetingId,
      action: auditAction,
      entityType: "ocr_job",
      entityId: jobId,
      metadata,
    });
  }

  return mapOcrRow(updated);
}

/**
 * Sort OCR jobs so that:
 * - Batches and standalone jobs are ordered most-recent-first (by the earliest
 *   job in each batch, i.e. the page_0 requestedAt).
 * - Within a batch, pages are ordered by imageSequence ascending (page 0 first).
 * This handles the case where sequential inserts give each page a slightly
 * different requestedAt, which would cause a naive DESC sort to reverse the pages.
 */
function sortOcrJobsBatchAware(jobs: DatabaseOcrJob[]): DatabaseOcrJob[] {
  const batchGroups = new Map<string, DatabaseOcrJob[]>();
  const standalone: DatabaseOcrJob[] = [];

  for (const job of jobs) {
    if (job.batch_id) {
      const group = batchGroups.get(job.batch_id) ?? [];
      group.push(job);
      batchGroups.set(job.batch_id, group);
    } else {
      standalone.push(job);
    }
  }

  // Sort within each batch by imageSequence ascending
  for (const group of batchGroups.values()) {
    group.sort((a, b) => (a.image_sequence ?? 0) - (b.image_sequence ?? 0));
  }

  // Build timeline entries for batches (keyed by earliest requestedAt = page 0)
  const timeline: { timestamp: number; jobs: DatabaseOcrJob[] }[] = [];

  for (const group of batchGroups.values()) {
    const earliest = Math.min(...group.map((j) => new Date(j.requested_at).getTime()));
    timeline.push({ timestamp: earliest, jobs: group });
  }

  for (const job of standalone) {
    timeline.push({ timestamp: new Date(job.requested_at).getTime(), jobs: [job] });
  }

  // Sort groups newest-first
  timeline.sort((a, b) => b.timestamp - a.timestamp);

  return timeline.flatMap((entry) => entry.jobs);
}

export async function getOcrJobsForMeeting(
  meetingId: string
): Promise<DatabaseOcrJob[]> {
  const rows = await db
    .select()
    .from(ocrJobs)
    .where(eq(ocrJobs.meetingId, meetingId))
    .orderBy(desc(ocrJobs.requestedAt));

  const mapped = rows.map((job) => mapOcrJob(mapOcrRow(job)));
  return sortOcrJobsBatchAware(mapped);
}

export const getOcrJobsForConsultation = getOcrJobsForMeeting;

export async function getOcrJob(jobId: string): Promise<DatabaseOcrJob> {
  const [job] = await db
    .select()
    .from(ocrJobs)
    .where(eq(ocrJobs.id, jobId))
    .limit(1);

  if (!job) {
    throw new Error("OCR job not found");
  }

  return mapOcrJob(mapOcrRow(job));
}

interface GetOcrJobTimelineParams {
  meetingId: string;
}

export async function getOcrJobTimeline({
  meetingId,
}: GetOcrJobTimelineParams): Promise<DatabaseOcrJob[]> {
  return getOcrJobsForMeeting(meetingId);
}

interface CreateIngestionArtifactParams {
  meetingId: string;
  artifactType: IngestionArtifactType;
  sourceFileKey: string;
  metadata?: Record<string, unknown>;
}

export async function createIngestionArtifact({
  meetingId,
  artifactType,
  sourceFileKey,
  metadata,
}: CreateIngestionArtifactParams): Promise<string> {
  const [created] = await db
    .insert(ingestionArtifacts)
    .values({
      meetingId,
      artifactType,
      sourceFileKey,
      metadata: metadata || null,
    })
    .returning({ id: ingestionArtifacts.id });

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
      consultationId: meetingId,
      action: auditAction,
      entityType: "ingestion_artifact",
      entityId: created.id,
      metadata: { artifactType, ...metadata },
    });
  }

  return created.id;
}

interface UpdateIngestionArtifactParams {
  artifactId: string;
  meetingId?: string;
  accepted?: boolean;
  notes?: string;
}

export async function updateIngestionArtifact({
  artifactId,
  meetingId,
  accepted,
  notes,
}: UpdateIngestionArtifactParams): Promise<DatabaseIngestionArtifact> {
  const updatePayload: Partial<typeof ingestionArtifacts.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (accepted !== undefined) updatePayload.accepted = accepted;
  if (notes !== undefined) updatePayload.notes = notes;

  const [updated] = await db
    .update(ingestionArtifacts)
    .set(updatePayload)
    .where(eq(ingestionArtifacts.id, artifactId))
    .returning();

  if (!updated) {
    throw new Error("Ingestion artifact not found");
  }

  const resolvedMeetingId = meetingId ?? updated.meetingId;

  if (accepted !== undefined) {
    const auditAction = accepted
      ? AUDIT_ACTIONS.OCR_REVIEW_ACCEPTED
      : AUDIT_ACTIONS.OCR_REVIEW_REJECTED;

    await emitAuditEvent({
      consultationId: resolvedMeetingId,
      action: auditAction,
      entityType: "ingestion_artifact",
      entityId: artifactId,
      metadata: { accepted, notes: notes || "" },
    });
  }

  return mapIngestionArtifactRow(updated);
}

interface GetIngestionArtifactTimelineParams {
  meetingId: string;
}

export async function getIngestionArtifactTimeline({
  meetingId,
}: GetIngestionArtifactTimelineParams): Promise<DatabaseIngestionArtifact[]> {
  const rows = await db
    .select()
    .from(ingestionArtifacts)
    .where(eq(ingestionArtifacts.meetingId, meetingId))
    .orderBy(desc(ingestionArtifacts.createdAt));

  return rows.map(mapIngestionArtifactRow);
}

export async function getIngestionArtifactsForMeeting(
  meetingId: string
): Promise<DatabaseIngestionArtifact[]> {
  return getIngestionArtifactTimeline({ meetingId });
}

export const getIngestionArtifactsForConsultation = getIngestionArtifactsForMeeting;

export async function getIngestionArtifactById(
  artifactId: string
): Promise<DatabaseIngestionArtifact> {
  const [artifact] = await db
    .select()
    .from(ingestionArtifacts)
    .where(eq(ingestionArtifacts.id, artifactId))
    .limit(1);

  if (!artifact) {
    throw new Error("Ingestion artifact not found");
  }

  return mapIngestionArtifactRow(artifact);
}

export async function getIngestionArtifactsByType(
  meetingId: string,
  artifactType: string
): Promise<DatabaseIngestionArtifact[]> {
  const rows = await db
    .select()
    .from(ingestionArtifacts)
    .where(
      and(
        eq(ingestionArtifacts.meetingId, meetingId),
        eq(ingestionArtifacts.artifactType, artifactType as IngestionArtifactType)
      )
    )
    .orderBy(desc(ingestionArtifacts.createdAt));

  return rows.map(mapIngestionArtifactRow);
}
