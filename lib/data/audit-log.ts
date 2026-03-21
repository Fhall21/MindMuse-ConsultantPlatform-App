"use server";

import { db } from "@/db/client";
import { auditLog } from "@/db/schema";
import { requireCurrentUserId } from "./auth-context";

interface EmitAuditEventParams {
  consultationId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

export async function insertAuditLogEntry({
  userId,
  consultationId,
  action,
  entityType,
  entityId,
  metadata,
}: EmitAuditEventParams & { userId: string }) {
  await db.insert(auditLog).values({
    meetingId: consultationId ?? null,
    action,
    entityType: entityType ?? null,
    entityId: entityId ?? null,
    payload: metadata ?? null,
    userId,
  });
}

export async function emitAuditEvent({
  consultationId,
  action,
  entityType,
  entityId,
  metadata,
}: EmitAuditEventParams) {
  try {
    const userId = await requireCurrentUserId();

    await insertAuditLogEntry({
      userId,
      consultationId,
      action,
      entityType,
      entityId,
      metadata,
    });
  } catch (error) {
    console.error("Audit event emission failed:", {
      action,
      consultationId,
      entityType,
      entityId,
      error,
    });
  }
}
