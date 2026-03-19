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

export async function emitAuditEvent({
  consultationId,
  action,
  entityType,
  entityId,
  metadata,
}: EmitAuditEventParams) {
  try {
    const userId = await requireCurrentUserId();

    await db.insert(auditLog).values({
      consultationId: consultationId ?? null,
      action,
      entityType: entityType ?? null,
      entityId: entityId ?? null,
      payload: metadata ?? null,
      userId,
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
