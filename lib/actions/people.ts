"use server";

import { createClient } from "@/lib/supabase/server";
import { AUDIT_ACTIONS } from "./audit-actions";
import { emitAuditEvent } from "./audit";

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

  const { data, error } = await supabase
    .from("people")
    .insert({
      user_id: user.user.id,
      name,
      working_group: working_group || null,
      work_type: work_type || null,
      role: role || null,
      email: email || null,
    })
    .select("id")
    .single();

  if (error) throw error;

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

  if (error) throw error;

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
