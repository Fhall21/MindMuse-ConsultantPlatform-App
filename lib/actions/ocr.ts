"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { ocrJobs } from "@/db/schema";
import { AUDIT_ACTIONS } from "./audit-actions";
import { emitAuditEvent } from "./audit";

/**
 * Persist a completed OCR result to ocr_jobs in a single insert.
 * Called after the client has received extracted text from /api/ocr/extract.
 * Returns the new job id.
 */
export async function submitOcrResult(params: {
  meetingId: string;
  extractedText: string;
  confidenceScore: number;
}): Promise<string> {
  const now = new Date();

  const [created] = await db
    .insert(ocrJobs)
    .values({
      meetingId: params.meetingId,
      // No Supabase Storage in v1 — record source inline
      imageFileKey: `inline/${params.meetingId}/${Date.now()}`,
      status: "completed",
      extractedText: params.extractedText,
      confidenceScore: params.confidenceScore.toString(),
      requestedAt: now,
      startedAt: now,
      completedAt: now,
    })
    .returning({ id: ocrJobs.id });

  await emitAuditEvent({
    consultationId: params.meetingId,
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
  meetingId: string,
  ocrJobId: string,
  correctedText: string
): Promise<void> {
  const [updated] = await db
    .update(ocrJobs)
    .set({
      extractedText: correctedText,
      updatedAt: new Date(),
    })
    .where(and(eq(ocrJobs.id, ocrJobId), eq(ocrJobs.meetingId, meetingId)))
    .returning();

  if (!updated) {
    throw new Error("OCR job not found");
  }

  await emitAuditEvent({
    consultationId: meetingId,
    action: AUDIT_ACTIONS.OCR_CORRECTIONS_SAVED,
    entityType: "ocr_job",
    entityId: ocrJobId,
    metadata: { correctedTextLength: correctedText.length },
  });
}
