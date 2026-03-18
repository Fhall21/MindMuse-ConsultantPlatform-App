"use server";

import { createClient } from "@/lib/supabase/server";

interface EmitAuditEventParams {
  consultationId?: string | null;
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
    consultation_id: consultationId ?? null,
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
