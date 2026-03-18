"use server";

import { createClient } from "@/lib/supabase/server";
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
  const supabase = await createClient();

  const { data: user } = await supabase.auth.getUser();
  if (!user.user) {
    throw new Error("Not authenticated");
  }

  const { data, error } = await supabase
    .from("consultation_rounds")
    .insert({
      user_id: user.user.id,
      label,
      description: description || null,
    })
    .select("id")
    .single();

  if (error) throw error;

  await emitAuditEvent({
    consultationId: null,
    action: AUDIT_ACTIONS.ROUND_CREATED,
    entityType: "consultation_round",
    entityId: data.id,
    metadata: {
      label,
      description: description || null,
    },
  });

  return data.id;
}

export async function updateRound({ id, label, description }: UpdateRoundParams) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("consultation_rounds")
    .update({
      label,
      description: description || null,
    })
    .eq("id", id);

  if (error) throw error;

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
  const supabase = await createClient();

  const { count, error: countError } = await supabase
    .from("consultations")
    .select("id", { count: "exact", head: true })
    .eq("round_id", id);

  if (countError) throw countError;

  if ((count ?? 0) > 0) {
    throw new Error("Cannot delete round with linked consultations.");
  }

  const { error } = await supabase.from("consultation_rounds").delete().eq("id", id);

  if (error) throw error;

  await emitAuditEvent({
    consultationId: null,
    action: AUDIT_ACTIONS.ROUND_DELETED,
    entityType: "consultation_round",
    entityId: id,
  });
}
