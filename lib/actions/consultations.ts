"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { consultations } from "@/db/schema";
import { requireCurrentUserId } from "@/lib/data/auth-context";
import { requireOwnedConsultation, requireOwnedRound } from "@/lib/data/ownership";
import { AUDIT_ACTIONS } from "./audit-actions";
import { emitAuditEvent } from "./audit";

interface CreateConsultationParams {
  title: string;
  roundId?: string;
}

export async function createConsultation({
  title,
  roundId,
}: CreateConsultationParams) {
  const userId = await requireCurrentUserId();

  if (roundId) {
    await requireOwnedRound(roundId, userId);
  }

  const [created] = await db
    .insert(consultations)
    .values({
      userId,
      title,
      roundId: roundId || null,
      status: "draft",
    })
    .returning({ id: consultations.id });

  await emitAuditEvent({
    consultationId: created.id,
    action: AUDIT_ACTIONS.CONSULTATION_CREATED,
    entityType: "consultation",
    entityId: created.id,
    metadata: { title, round_id: roundId || null, roundId: roundId || null },
  });

  return created.id;
}

interface UpdateTranscriptParams {
  id: string;
  transcriptRaw: string;
}

export async function updateConsultationTitle({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  const trimmedTitle = title.trim();

  if (!trimmedTitle) {
    throw new Error("Title is required");
  }

  if (trimmedTitle.length > 255) {
    throw new Error("Title must be 255 characters or fewer");
  }

  const userId = await requireCurrentUserId();
  await requireOwnedConsultation(id, userId);

  await db
    .update(consultations)
    .set({ title: trimmedTitle })
    .where(and(eq(consultations.id, id), eq(consultations.userId, userId)));

  await emitAuditEvent({
    consultationId: id,
    action: AUDIT_ACTIONS.CONSULTATION_TITLE_EDITED,
    entityType: "consultation",
    entityId: id,
    metadata: { title: trimmedTitle },
  });
}

export async function updateTranscript({
  id,
  transcriptRaw,
}: UpdateTranscriptParams) {
  const userId = await requireCurrentUserId();
  await requireOwnedConsultation(id, userId);

  await db
    .update(consultations)
    .set({ transcriptRaw })
    .where(and(eq(consultations.id, id), eq(consultations.userId, userId)));

  await emitAuditEvent({
    consultationId: id,
    action: AUDIT_ACTIONS.CONSULTATION_TRANSCRIPT_EDITED,
    entityType: "consultation",
    entityId: id,
    metadata: { transcriptLength: transcriptRaw.length },
  });
}

export async function setConsultationRound(
  id: string,
  roundId: string | null
) {
  const userId = await requireCurrentUserId();
  await requireOwnedConsultation(id, userId);
  if (roundId) {
    await requireOwnedRound(roundId, userId);
  }

  await db
    .update(consultations)
    .set({ roundId })
    .where(and(eq(consultations.id, id), eq(consultations.userId, userId)));

  await emitAuditEvent({
    consultationId: id,
    action: AUDIT_ACTIONS.CONSULTATION_ROUND_ASSIGNED,
    entityType: "consultation",
    entityId: id,
    metadata: { round_id: roundId, roundId },
  });
}

export async function updateNotes({
  id,
  notes,
}: {
  id: string;
  notes: string;
}) {
  const userId = await requireCurrentUserId();
  await requireOwnedConsultation(id, userId);
  void notes;
  throw new Error(
    "Consultation notes are not available yet in the Drizzle schema. Add the notes column migration before using this action."
  );
}

export async function markConsultationComplete(id: string) {
  const userId = await requireCurrentUserId();
  await requireOwnedConsultation(id, userId);

  await db
    .update(consultations)
    .set({ status: "complete" })
    .where(and(eq(consultations.id, id), eq(consultations.userId, userId)));

  await emitAuditEvent({
    consultationId: id,
    action: AUDIT_ACTIONS.CONSULTATION_COMPLETED,
    entityType: "consultation",
    entityId: id,
  });
}
