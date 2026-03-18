"use server";

import { createClient } from "@/lib/supabase/server";
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
      "The database is missing the new People classification fields. Run the latest Supabase migration, then try again."
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
  const supabase = await createClient();

  const { data: user } = await supabase.auth.getUser();
  if (!user.user) {
    throw new Error("Not authenticated");
  }

  const personPayload: Record<string, string | null> = {
    user_id: user.user.id,
    name,
    role: role || null,
    email: email || null,
  };

  if (working_group !== undefined) {
    personPayload.working_group = working_group || null;
  }

  if (work_type !== undefined) {
    personPayload.work_type = work_type || null;
  }

  const { data, error } = await supabase
    .from("people")
    .insert(personPayload)
    .select("id")
    .single();

  if (error) throw normalizePeopleWriteError(error);

  return data.id;
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
  const supabase = await createClient();

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (working_group !== undefined) updates.working_group = working_group || null;
  if (work_type !== undefined) updates.work_type = work_type || null;
  if (role !== undefined) updates.role = role || null;
  if (email !== undefined) updates.email = email || null;

  const { error } = await supabase
    .from("people")
    .update(updates)
    .eq("id", id);

  if (error) throw normalizePeopleWriteError(error);

  await emitAuditEvent({
    consultationId: null,
    action: AUDIT_ACTIONS.PERSON_UPDATED,
    entityType: "person",
    entityId: id,
    metadata: updates,
  });
}

export async function deletePerson(id: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("people").delete().eq("id", id);

  if (error) throw error;

  await emitAuditEvent({
    consultationId: null,
    action: AUDIT_ACTIONS.PERSON_DELETED,
    entityType: "person",
    entityId: id,
  });
}

export async function linkPersonToConsultation(
  consultationId: string,
  personId: string
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("consultation_people")
    .insert({
      consultation_id: consultationId,
      person_id: personId,
    });

  if (error && error.code !== "23505") {
    // 23505 is unique constraint violation (already linked)
    throw error;
  }

  await emitAuditEvent({
    consultationId,
    action: AUDIT_ACTIONS.PERSON_LINKED,
    entityType: "person",
    entityId: personId,
    metadata: { personId },
  });
}

export async function unlinkPersonFromConsultation(
  consultationId: string,
  personId: string
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("consultation_people")
    .delete()
    .eq("consultation_id", consultationId)
    .eq("person_id", personId);

  if (error) throw error;

  await emitAuditEvent({
    consultationId,
    action: AUDIT_ACTIONS.PERSON_UNLINKED,
    entityType: "person",
    entityId: personId,
    metadata: { personId },
  });
}
