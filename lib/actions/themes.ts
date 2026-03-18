"use server";

import { createClient } from "@/lib/supabase/server";
import { emitAuditEvent, AUDIT_ACTIONS } from "./audit";

interface ThemeData {
  label: string;
  confidence?: number;
}

export async function saveThemes(
  consultationId: string,
  themes: ThemeData[]
) {
  const supabase = await createClient();

  const themesWithConsultationId = themes.map((theme) => ({
    consultation_id: consultationId,
    label: theme.label,
    accepted: false,
  }));

  const { data, error } = await supabase
    .from("themes")
    .insert(themesWithConsultationId)
    .select("id");

  if (error) throw error;

  await emitAuditEvent({
    consultationId,
    action: AUDIT_ACTIONS.THEME_EXTRACTION_REQUESTED,
    entityType: "themes",
    metadata: { count: themes.length },
  });

  return data;
}

export async function acceptTheme(id: string, consultationId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("themes")
    .update({ accepted: true })
    .eq("id", id);

  if (error) throw error;

  await emitAuditEvent({
    consultationId,
    action: AUDIT_ACTIONS.THEME_ACCEPTED,
    entityType: "theme",
    entityId: id,
  });
}

export async function rejectTheme(id: string, consultationId: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("themes").delete().eq("id", id);

  if (error) throw error;

  await emitAuditEvent({
    consultationId,
    action: AUDIT_ACTIONS.THEME_REJECTED,
    entityType: "theme",
    entityId: id,
  });
}
