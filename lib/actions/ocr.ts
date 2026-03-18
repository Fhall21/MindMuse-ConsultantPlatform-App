"use server";

import { createClient } from "@/lib/supabase/server";
import { AUDIT_ACTIONS } from "./audit-actions";
import { emitAuditEvent } from "./audit";

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
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("ocr_jobs")
    .insert({
      consultation_id: params.consultationId,
      // No Supabase Storage in v1 — record source inline
      image_file_key: `inline/${params.consultationId}/${Date.now()}`,
      status: "completed",
      extracted_text: params.extractedText,
      confidence_score: params.confidenceScore,
      requested_at: now,
      started_at: now,
      completed_at: now,
    })
    .select("id")
    .single();

  if (error) throw error;

  await emitAuditEvent({
    consultationId: params.consultationId,
    action: AUDIT_ACTIONS.OCR_EXTRACTION_COMPLETED,
    entityType: "ocr_job",
    entityId: data.id,
    metadata: {
      confidenceScore: params.confidenceScore,
      extractedTextLength: params.extractedText.length,
    },
  });

  return data.id;
}

export async function saveOcrCorrections(
  consultationId: string,
  ocrJobId: string,
  correctedText: string
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("ocr_jobs")
    .update({ extracted_text: correctedText })
    .eq("id", ocrJobId)
    .eq("consultation_id", consultationId);

  if (error) throw error;

  await emitAuditEvent({
    consultationId,
    action: AUDIT_ACTIONS.OCR_CORRECTIONS_SAVED,
    entityType: "ocr_job",
    entityId: ocrJobId,
    metadata: { correctedTextLength: correctedText.length },
  });
}
