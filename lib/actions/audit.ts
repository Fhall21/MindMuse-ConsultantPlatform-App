"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Audit action catalog — canonical list of all audit event action strings
 * Keep this synchronized across the codebase
 */
export const AUDIT_ACTIONS = {
  CONSULTATION_CREATED: "consultation.created",
  CONSULTATION_TRANSCRIPT_EDITED: "consultation.transcript_edited",
  CONSULTATION_COMPLETED: "consultation.completed",
  ROUND_CREATED: "round.created",
  ROUND_UPDATED: "round.updated",
  ROUND_DELETED: "round.deleted",
  PERSON_CREATED: "person.created",
  PERSON_UPDATED: "person.updated",
  PERSON_DELETED: "person.deleted",
  PERSON_LINKED: "person.linked",
  PERSON_UNLINKED: "person.unlinked",
  THEME_EXTRACTION_REQUESTED: "theme.extraction_requested",
  THEME_ACCEPTED: "theme.accepted",
  THEME_REJECTED: "theme.rejected",
  EVIDENCE_EMAIL_GENERATION_REQUESTED: "evidence_email.generation_requested",
  EVIDENCE_EMAIL_GENERATED: "evidence_email.generated",
  EVIDENCE_EMAIL_ACCEPTED: "evidence_email.accepted",
  EVIDENCE_EMAIL_SENT: "evidence_email.sent",
} as const;

interface EmitAuditEventParams {
  consultationId: string;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Emit an audit event to the audit_log table
 * Called by all domain actions to maintain compliance trail
 */
export async function emitAuditEvent({
  consultationId,
  action,
  entityType,
  entityId,
  metadata,
}: EmitAuditEventParams) {
  const supabase = await createClient();

  const { data: user } = await supabase.auth.getUser();
  if (!user.user) {
    throw new Error("Not authenticated");
  }

  const { error } = await supabase.from("audit_log").insert({
    consultation_id: consultationId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    payload: metadata || null,
    user_id: user.user.id,
  });

  if (error) {
    console.error("Audit event emission failed:", error);
    throw error;
  }
}
