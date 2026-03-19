"use server";

import { emitAuditEvent as emitAppAuditEvent } from "@/lib/data/audit-log";

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
  await emitAppAuditEvent({
    consultationId,
    action,
    entityType,
    entityId,
    metadata,
  });
}
