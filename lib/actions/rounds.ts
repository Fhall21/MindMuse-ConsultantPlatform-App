"use server";

import { and, count, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { consultations, meetings } from "@/db/schema";
import { requireCurrentUserId } from "@/lib/data/auth-context";
import { requireOwnedRound } from "@/lib/data/ownership";
import { AUDIT_ACTIONS } from "@/lib/actions/audit-actions";
import { emitAuditEvent } from "@/lib/actions/audit";

interface CreateRoundParams {
  label: string;
  description?: string;
}

interface UpdateRoundParams {
  id: string;
  label: string;
  description?: string;
}

export async function createRound({ label, description }: CreateRoundParams) {
  const userId = await requireCurrentUserId();

  const [created] = await db
    .insert(consultations)
    .values({
      userId,
      label,
      description: description || null,
    })
    .returning({ id: consultations.id });

  await emitAuditEvent({
    consultationId: null,
    action: AUDIT_ACTIONS.ROUND_CREATED,
    entityType: "consultation_round",
    entityId: created.id,
    metadata: {
      label,
      description: description || null,
    },
  });

  return created.id;
}

export async function updateRound({ id, label, description }: UpdateRoundParams) {
  const userId = await requireCurrentUserId();
  await requireOwnedRound(id, userId);

  await db
    .update(consultations)
    .set({
      label,
      description: description || null,
    })
    .where(and(eq(consultations.id, id), eq(consultations.userId, userId)));

  await emitAuditEvent({
    consultationId: null,
    action: AUDIT_ACTIONS.ROUND_UPDATED,
    entityType: "consultation_round",
    entityId: id,
    metadata: {
      label,
      description: description || null,
    },
  });
}

export async function deleteRound(id: string) {
  const userId = await requireCurrentUserId();
  await requireOwnedRound(id, userId);

  const [{ linkedCount }] = await db
    .select({ linkedCount: count() })
    .from(meetings)
    .where(
      and(eq(meetings.consultationId, id), eq(meetings.userId, userId))
    );

  if ((linkedCount ?? 0) > 0) {
    throw new Error("Cannot delete consultation with linked meetings.");
  }

  await db
    .delete(consultations)
    .where(and(eq(consultations.id, id), eq(consultations.userId, userId)));

  await emitAuditEvent({
    consultationId: null,
    action: AUDIT_ACTIONS.ROUND_DELETED,
    entityType: "consultation_round",
    entityId: id,
  });
}
