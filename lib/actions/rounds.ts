"use server";

import { and, count, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { consultationRounds, consultations } from "@/db/schema";
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
    .insert(consultationRounds)
    .values({
      userId,
      label,
      description: description || null,
    })
    .returning({ id: consultationRounds.id });

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
    .update(consultationRounds)
    .set({
      label,
      description: description || null,
    })
    .where(and(eq(consultationRounds.id, id), eq(consultationRounds.userId, userId)));

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
    .from(consultations)
    .where(
      and(eq(consultations.roundId, id), eq(consultations.userId, userId))
    );

  if ((linkedCount ?? 0) > 0) {
    throw new Error("Cannot delete round with linked consultations.");
  }

  await db
    .delete(consultationRounds)
    .where(and(eq(consultationRounds.id, id), eq(consultationRounds.userId, userId)));

  await emitAuditEvent({
    consultationId: null,
    action: AUDIT_ACTIONS.ROUND_DELETED,
    entityType: "consultation_round",
    entityId: id,
  });
}
