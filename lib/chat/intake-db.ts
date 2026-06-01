import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { consultations, meetingPeople, meetings, people } from "@/db/schema";
import { AUDIT_ACTIONS } from "@/lib/actions/audit-actions";
import { emitAuditEvent } from "@/lib/actions/audit";
import { requireOwnedConsultation, requireOwnedMeeting } from "@/lib/data/ownership";
import type { LinkedPersonRecord, MeetingDraft, MeetingRecord } from "./tools/intake";

function parseMeetingDate(date: string): Date | null {
  if (!date) {
    return null;
  }
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function confirmMeetingFromDraft(params: {
  userId: string;
  projectId: string;
  meetingDraft: MeetingDraft;
}): Promise<MeetingRecord> {
  await requireOwnedConsultation(params.projectId, params.userId);

  const meetingDate = parseMeetingDate(params.meetingDraft.date);
  const sourceText = params.meetingDraft.source_text?.trim() ?? "";
  const intakeKind = params.meetingDraft.intake_kind ?? "transcript";

  const [created] = await db
    .insert(meetings)
    .values({
      userId: params.userId,
      title: params.meetingDraft.title.trim(),
      consultationId: params.projectId,
      meetingTypeId: params.meetingDraft.meeting_type_id ?? null,
      meetingDate,
      status: "draft",
      isArchived: false,
      transcriptRaw: intakeKind !== "notes" && sourceText ? sourceText : null,
      notes:
        intakeKind === "notes"
          ? sourceText || params.meetingDraft.notes_preview || null
          : null,
    })
    .returning({
      id: meetings.id,
      title: meetings.title,
      meetingDate: meetings.meetingDate,
      consultationId: meetings.consultationId,
    });

  await emitAuditEvent({
    consultationId: created.id,
    action: AUDIT_ACTIONS.MEETING_CREATED,
    entityType: "meeting",
    entityId: created.id,
    metadata: {
      title: created.title,
      consultation_id: params.projectId,
      source: "chat_confirm_meeting",
    },
  });

  return {
    id: created.id,
    title: created.title,
    date: created.meetingDate?.toISOString() ?? params.meetingDraft.date,
    projectId: created.consultationId ?? params.projectId,
  };
}

async function findOwnedPersonByName(userId: string, name: string) {
  const normalized = name.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const [person] = await db
    .select({ id: people.id, name: people.name })
    .from(people)
    .where(and(eq(people.userId, userId), sql`lower(${people.name}) = ${normalized}`))
    .limit(1);

  return person ?? null;
}

export async function linkPeopleByIdsToMeeting(params: {
  userId: string;
  meetingId: string;
  personIds: string[];
}): Promise<LinkedPersonRecord[]> {
  await requireOwnedMeeting(params.meetingId, params.userId);

  const uniqueIds = [...new Set(params.personIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return [];
  }

  const ownedPeople = await db
    .select({ id: people.id, name: people.name })
    .from(people)
    .where(and(eq(people.userId, params.userId), inArray(people.id, uniqueIds)));

  if (ownedPeople.length === 0) {
    return [];
  }

  await db
    .insert(meetingPeople)
    .values(
      ownedPeople.map((person) => ({
        meetingId: params.meetingId,
        personId: person.id,
      }))
    )
    .onConflictDoNothing();

  if (ownedPeople.length > 0) {
    await emitAuditEvent({
      consultationId: params.meetingId,
      action: AUDIT_ACTIONS.PERSON_LINKED,
      entityType: "meeting",
      entityId: params.meetingId,
      metadata: {
        linked_count: ownedPeople.length,
        source: "chat_link_people_ids",
      },
    });
  }

  return ownedPeople.map((person) => ({
    id: person.id,
    name: person.name,
    matched: true,
    created: false,
  }));
}

export async function linkPeopleToMeeting(params: {
  userId: string;
  meetingId: string;
  participantNames: string[];
}): Promise<LinkedPersonRecord[]> {
  await requireOwnedMeeting(params.meetingId, params.userId);

  const results: LinkedPersonRecord[] = [];

  for (const rawName of params.participantNames) {
    const name = rawName.trim();
    if (!name) {
      continue;
    }

    const existing = await findOwnedPersonByName(params.userId, name);
    if (existing) {
      await db
        .insert(meetingPeople)
        .values({ meetingId: params.meetingId, personId: existing.id })
        .onConflictDoNothing();

      results.push({
        id: existing.id,
        name: existing.name,
        matched: true,
        created: false,
      });
      continue;
    }

    const [created] = await db
      .insert(people)
      .values({ userId: params.userId, name })
      .returning({ id: people.id, name: people.name });

    await db
      .insert(meetingPeople)
      .values({ meetingId: params.meetingId, personId: created.id })
      .onConflictDoNothing();

    results.push({
      id: created.id,
      name: created.name,
      matched: false,
      created: true,
    });
  }

  if (results.length > 0) {
    await emitAuditEvent({
      consultationId: params.meetingId,
      action: AUDIT_ACTIONS.PERSON_LINKED,
      entityType: "meeting",
      entityId: params.meetingId,
      metadata: {
        linked_count: results.length,
        source: "chat_link_people",
      },
    });
  }

  return results;
}

export async function listConsultationsForUser(userId: string) {
  return db
    .select({ id: consultations.id, label: consultations.label })
    .from(consultations)
    .where(eq(consultations.userId, userId))
    .orderBy(consultations.label);
}
