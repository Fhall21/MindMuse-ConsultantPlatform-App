"use server";

import { createClient } from "@/lib/supabase/server";
import { emitAuditEvent, AUDIT_ACTIONS } from "./audit";

interface CreateConsultationParams {
  title: string;
  roundId?: string;
}

export async function createConsultation({
  title,
  roundId,
}: CreateConsultationParams) {
  const supabase = await createClient();

  const { data: user } = await supabase.auth.getUser();
  if (!user.user) {
    throw new Error("Not authenticated");
  }

  const { data, error } = await supabase
    .from("consultations")
    .insert({
      user_id: user.user.id,
      title,
      round_id: roundId || null,
      status: "draft",
    })
    .select("id")
    .single();

  if (error) throw error;

  await emitAuditEvent({
    consultationId: data.id,
    action: AUDIT_ACTIONS.CONSULTATION_CREATED,
    entityType: "consultation",
    entityId: data.id,
    metadata: { title, roundId: roundId || null },
  });

  return data.id;
}

interface UpdateTranscriptParams {
  id: string;
  transcriptRaw: string;
}

export async function updateTranscript({
  id,
  transcriptRaw,
}: UpdateTranscriptParams) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("consultations")
    .update({ transcript_raw: transcriptRaw })
    .eq("id", id);

  if (error) throw error;

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
  const supabase = await createClient();

  const { error } = await supabase
    .from("consultations")
    .update({ round_id: roundId })
    .eq("id", id);

  if (error) throw error;

  await emitAuditEvent({
    consultationId: id,
    action: "consultation.round_assigned",
    entityType: "consultation",
    entityId: id,
    metadata: { roundId },
  });
}

// TODO: Agent 1 — add `notes text` column to consultations migration before this works
export async function updateNotes({
  id,
  notes,
}: {
  id: string;
  notes: string;
}) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("consultations")
    .update({ notes } as Record<string, unknown>)
    .eq("id", id);

  if (error) throw error;

  await emitAuditEvent({
    consultationId: id,
    action: "consultation.notes_edited",
    entityType: "consultation",
    entityId: id,
    metadata: { notesLength: notes.length },
  });
}

export async function markConsultationComplete(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("consultations")
    .update({ status: "complete" })
    .eq("id", id);

  if (error) throw error;

  await emitAuditEvent({
    consultationId: id,
    action: AUDIT_ACTIONS.CONSULTATION_COMPLETED,
    entityType: "consultation",
    entityId: id,
  });
}
