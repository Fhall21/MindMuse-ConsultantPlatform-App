"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { meetingPeople, people } from "@/db/schema";
import { requireCurrentUserId } from "@/lib/data/auth-context";
import {
  requireOwnedMeeting,
  requireOwnedPerson,
} from "@/lib/data/ownership";
import { AUDIT_ACTIONS } from "./audit-actions";
import { emitAuditEvent } from "./audit";

function normalizePeopleWriteError(error: unknown) {
  if (!error || typeof error !== "object") {
    return error;
  }

  const record = error as Record<string, unknown>;
  const combinedText = [
    record.code,
    record.message,
    record.details,
    record.hint,
  ]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ")
    .toLowerCase();

  const isClassificationSchemaError =
    (combinedText.includes("working_group") || combinedText.includes("work_type")) &&
    (combinedText.includes("schema cache") ||
      combinedText.includes("column") ||
      combinedText.includes("does not exist"));

  if (isClassificationSchemaError) {
    return new Error(
      "The database is missing the new People classification fields. Run the latest database migration, then try again."
    );
  }

  return error;
}

interface CreatePersonParams {
  name: string;
  working_group?: string;
  work_type?: string;
  role?: string;
  email?: string;
}

export async function createPerson({
  name,
  working_group,
  work_type,
  role,
  email,
}: CreatePersonParams) {
  const userId = await requireCurrentUserId();

  const personPayload: {
    name: string;
    userId: string;
    role: string | null;
    email: string | null;
    workingGroup?: string | null;
    workType?: string | null;
  } = {
    userId,
    name,
    role: role || null,
    email: email || null,
  };

  if (working_group !== undefined) {
    personPayload.workingGroup = working_group || null;
  }

  if (work_type !== undefined) {
    personPayload.workType = work_type || null;
  }

  const [created] = await db
    .insert(people)
    .values(personPayload)
    .returning({ id: people.id });

  return created.id;
}

interface UpdatePersonParams {
  id: string;
  name?: string;
  working_group?: string;
  work_type?: string;
  role?: string;
  email?: string;
}

export async function updatePerson({
  id,
  name,
  working_group,
  work_type,
  role,
  email,
}: UpdatePersonParams) {
  const userId = await requireCurrentUserId();
  await requireOwnedPerson(id, userId);

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (working_group !== undefined) updates.workingGroup = working_group || null;
  if (work_type !== undefined) updates.workType = work_type || null;
  if (role !== undefined) updates.role = role || null;
  if (email !== undefined) updates.email = email || null;

  try {
    await db
      .update(people)
      .set(updates)
      .where(and(eq(people.id, id), eq(people.userId, userId)));
  } catch (error) {
    throw normalizePeopleWriteError(error);
  }

  await emitAuditEvent({
    consultationId: null,
    action: AUDIT_ACTIONS.PERSON_UPDATED,
    entityType: "person",
    entityId: id,
    metadata: updates,
  });
}

export async function deletePerson(id: string) {
  const userId = await requireCurrentUserId();
  await requireOwnedPerson(id, userId);

  await db.delete(people).where(and(eq(people.id, id), eq(people.userId, userId)));

  await emitAuditEvent({
    consultationId: null,
    action: AUDIT_ACTIONS.PERSON_DELETED,
    entityType: "person",
    entityId: id,
  });
}

export async function linkPersonToConsultation(
  meetingId: string,
  personId: string
) {
  const userId = await requireCurrentUserId();
  await requireOwnedMeeting(meetingId, userId);
  await requireOwnedPerson(personId, userId);

  try {
    await db
      .insert(meetingPeople)
      .values({
        meetingId,
        personId,
      })
      .onConflictDoNothing();
  } catch (error) {
    throw error;
  }

  await emitAuditEvent({
    consultationId: meetingId,
    action: AUDIT_ACTIONS.PERSON_LINKED,
    entityType: "person",
    entityId: personId,
    metadata: { personId },
  });
}

export async function unlinkPersonFromConsultation(
  meetingId: string,
  personId: string
) {
  const userId = await requireCurrentUserId();
  await requireOwnedMeeting(meetingId, userId);
  await requireOwnedPerson(personId, userId);

  await db
    .delete(meetingPeople)
    .where(
      and(
        eq(meetingPeople.meetingId, meetingId),
        eq(meetingPeople.personId, personId)
      )
    );

  await emitAuditEvent({
    consultationId: meetingId,
    action: AUDIT_ACTIONS.PERSON_UNLINKED,
    entityType: "person",
    entityId: personId,
    metadata: { personId },
  });
}
