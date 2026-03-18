"use server";

import { createClient } from "@/lib/supabase/server";
import { emitAuditEvent, AUDIT_ACTIONS } from "./audit";

interface CreatePersonParams {
  name: string;
  role?: string;
  email?: string;
}

export async function createPerson({
  name,
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
  role?: string;
  email?: string;
}

export async function updatePerson({
  id,
  name,
  role,
  email,
}: UpdatePersonParams) {
  const supabase = await createClient();

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (role !== undefined) updates.role = role || null;
  if (email !== undefined) updates.email = email || null;

  const { error } = await supabase
    .from("people")
    .update(updates)
    .eq("id", id);

  if (error) throw error;

  await emitAuditEvent({
    consultationId: "", // Person updates are not consultation-specific; leave blank
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
    consultationId: "",
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
