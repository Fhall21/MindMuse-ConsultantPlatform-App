"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { consultations, meetings, meetingPeople, people } from "@/db/schema";
import { requireCurrentUserId } from "@/lib/data/auth-context";
import { requireOwnedMeeting, requireOwnedConsultation } from "@/lib/data/ownership";
import { AUDIT_ACTIONS } from "./audit-actions";
import { emitAuditEvent } from "./audit";

interface CreateMeetingParams {
  title: string;
  consultationId?: string;
  /** Pass this instead of consultationId to create a new consultation inline */
  newConsultationLabel?: string;
  meetingTypeId?: string;
  meetingDate?: Date;
  /** IDs of existing people to link immediately */
  personIds?: string[];
}

export async function createMeeting({
  title,
  consultationId,
  newConsultationLabel,
  meetingTypeId,
  meetingDate,
  personIds = [],
}: CreateMeetingParams) {
  const userId = await requireCurrentUserId();

  let resolvedConsultationId = consultationId || null;

  // Inline consultation create
  if (!resolvedConsultationId && newConsultationLabel?.trim()) {
    const [newConsultation] = await db
      .insert(consultations)
      .values({ userId, label: newConsultationLabel.trim() })
      .returning({ id: consultations.id });
    resolvedConsultationId = newConsultation.id;
  }

  if (resolvedConsultationId) {
    await requireOwnedConsultation(resolvedConsultationId, userId);
  }

  const [created] = await db
    .insert(meetings)
    .values({
      userId,
      title,
      consultationId: resolvedConsultationId,
      meetingTypeId: meetingTypeId || null,
      meetingDate: meetingDate || null,
      status: "draft",
    })
    .returning({ id: meetings.id });

  // Link people atomically
  if (personIds.length > 0) {
    // Verify all people belong to this user
    const ownedPeople = await db
      .select({ id: people.id })
      .from(people)
      .where(and(eq(people.userId, userId)));
    const ownedIds = new Set(ownedPeople.map((p) => p.id));
    const validIds = personIds.filter((id) => ownedIds.has(id));

    if (validIds.length > 0) {
      await db
        .insert(meetingPeople)
        .values(validIds.map((personId) => ({ meetingId: created.id, personId })))
        .onConflictDoNothing();
    }
  }

  await emitAuditEvent({
    consultationId: created.id,
    action: AUDIT_ACTIONS.MEETING_CREATED,
    entityType: "meeting",
    entityId: created.id,
    metadata: {
      title,
      consultation_id: resolvedConsultationId,
      meeting_type_id: meetingTypeId || null,
      person_count: personIds.length,
    },
  });

  return created.id;
}

export const createConsultation = createMeeting;

interface UpdateTranscriptParams {
  id: string;
  transcriptRaw: string;
}

export async function updateMeetingTitle({
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
  await requireOwnedMeeting(id, userId);

  await db
    .update(meetings)
    .set({ title: trimmedTitle })
    .where(and(eq(meetings.id, id), eq(meetings.userId, userId)));

  await emitAuditEvent({
    consultationId: id,
    action: AUDIT_ACTIONS.MEETING_TITLE_EDITED,
    entityType: "meeting",
    entityId: id,
    metadata: { title: trimmedTitle },
  });
}

export const updateConsultationTitle = updateMeetingTitle;

export async function updateTranscript({
  id,
  transcriptRaw,
}: UpdateTranscriptParams) {
  const userId = await requireCurrentUserId();
  await requireOwnedMeeting(id, userId);

  await db
    .update(meetings)
    .set({ transcriptRaw })
    .where(and(eq(meetings.id, id), eq(meetings.userId, userId)));

  await emitAuditEvent({
    consultationId: id,
    action: AUDIT_ACTIONS.MEETING_TRANSCRIPT_EDITED,
    entityType: "meeting",
    entityId: id,
    metadata: { transcriptLength: transcriptRaw.length },
  });
}

export async function assignMeetingConsultation(
  id: string,
  consultationId: string | null
) {
  const userId = await requireCurrentUserId();
  await requireOwnedMeeting(id, userId);
  if (consultationId) {
    await requireOwnedConsultation(consultationId, userId);
  }

  await db
    .update(meetings)
    .set({ consultationId })
    .where(and(eq(meetings.id, id), eq(meetings.userId, userId)));

  await emitAuditEvent({
    consultationId: id,
    action: AUDIT_ACTIONS.MEETING_CONSULTATION_ASSIGNED,
    entityType: "meeting",
    entityId: id,
    metadata: { consultation_id: consultationId },
  });
}

export const setConsultationRound = assignMeetingConsultation;

export async function updateNotes({
  id,
  notes,
}: {
  id: string;
  notes: string;
}) {
  const userId = await requireCurrentUserId();
  await requireOwnedMeeting(id, userId);
  void notes;
  throw new Error(
    "Meeting notes are not available yet in the Drizzle schema. Add the notes column migration before using this action."
  );
}

export async function markMeetingComplete(id: string) {
  const userId = await requireCurrentUserId();
  await requireOwnedMeeting(id, userId);

  await db
    .update(meetings)
    .set({ status: "complete" })
    .where(and(eq(meetings.id, id), eq(meetings.userId, userId)));

  await emitAuditEvent({
    consultationId: id,
    action: AUDIT_ACTIONS.MEETING_COMPLETED,
    entityType: "meeting",
    entityId: id,
  });
}

export const markConsultationComplete = markMeetingComplete;
