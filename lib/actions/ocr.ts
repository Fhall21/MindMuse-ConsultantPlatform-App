"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { ocrJobs } from "@/db/schema";
import { AUDIT_ACTIONS } from "./audit-actions";
import { emitAuditEvent } from "./audit";
import type { OcrJob as DatabaseOcrJob } from "@/types/db";

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

function mapOcrJob(row: typeof ocrJobs.$inferSelect): DatabaseOcrJob {
  return {
    id: row.id,
    consultation_id: row.consultationId,
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
  };
}

/**
 * Persist a completed OCR result to ocr_jobs in a single insert.
 * Called after the client has received extracted text from /api/ocr/extract.
 * Returns the new job id.
 */
export async function submitOcrResult(params: {
  consultationId: string;
  extractedText: string;
  confidenceScore: number;
}): Promise<string> {
  const now = new Date();

  const [created] = await db
    .insert(ocrJobs)
    .values({
      consultationId: params.consultationId,
      // No Supabase Storage in v1 — record source inline
      imageFileKey: `inline/${params.consultationId}/${Date.now()}`,
      status: "completed",
      extractedText: params.extractedText,
      confidenceScore: params.confidenceScore.toString(),
      requestedAt: now,
      startedAt: now,
      completedAt: now,
    })
    .returning({ id: ocrJobs.id });

  await emitAuditEvent({
    consultationId: params.consultationId,
    action: AUDIT_ACTIONS.OCR_EXTRACTION_COMPLETED,
    entityType: "ocr_job",
    entityId: created.id,
    metadata: {
      confidenceScore: params.confidenceScore,
      extractedTextLength: params.extractedText.length,
    },
  });

  return created.id;
}

export async function saveOcrCorrections(
  consultationId: string,
  ocrJobId: string,
  correctedText: string
): Promise<void> {
  const [updated] = await db
    .update(ocrJobs)
    .set({
      extractedText: correctedText,
      updatedAt: new Date(),
    })
    .where(and(eq(ocrJobs.id, ocrJobId), eq(ocrJobs.consultationId, consultationId)))
    .returning();

  if (!updated) {
    throw new Error("OCR job not found");
  }

  await emitAuditEvent({
    consultationId,
    action: AUDIT_ACTIONS.OCR_CORRECTIONS_SAVED,
    entityType: "ocr_job",
    entityId: ocrJobId,
    metadata: { correctedTextLength: correctedText.length },
  });
}
