"use server";

import { createClient } from "@/lib/supabase/server";
import { AUDIT_ACTIONS } from "./audit-actions";
import { emitAuditEvent } from "./audit";

interface ThemeData {
  label: string;
  confidence?: number;
  description?: string | null;
}

function trimToNull(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function saveThemes(
  consultationId: string,
  themes: ThemeData[]
) {
  const supabase = await createClient();

  const themesWithConsultationId = themes.map((theme) => ({
    consultation_id: consultationId,
    label: theme.label,
    description: theme.description ?? null,
    accepted: false,
    is_user_added: false,
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

/**
 * Accept a theme and log the decision for learning signals
 * Optionally associate with a consultation round
 */
export async function acceptTheme(
  id: string,
  consultationId: string,
  roundId?: string
) {
  const supabase = await createClient();

  const { data: user } = await supabase.auth.getUser();
  if (!user.user) {
    throw new Error("Not authenticated");
  }

  const { data: theme, error: themeError } = await supabase
    .from("themes")
    .select("id, label")
    .eq("id", id)
    .eq("consultation_id", consultationId)
    .single();

  if (themeError) throw themeError;

  const { error } = await supabase
    .from("themes")
    .update({ accepted: true })
    .eq("id", id);

  if (error) throw error;

  // Log the decision for learning signals
  const { error: logError } = await supabase
    .from("theme_decision_logs")
    .insert({
      user_id: user.user.id,
      consultation_id: consultationId,
      theme_id: id,
      theme_label: theme.label,
      round_id: roundId || null,
      decision_type: "accept",
      rationale: null,
    });

  if (logError) throw logError;

  // Emit audit event with decision context
  await emitAuditEvent({
    consultationId,
    action: AUDIT_ACTIONS.THEME_ACCEPTED,
    entityType: "theme",
    entityId: id,
    metadata: {
      decision_type: "accept",
      theme_label: theme.label,
      round_id: roundId || null,
    },
  });
}

/**
 * Reject a theme and remove it from active use.
 * Rationale is optional while the consultation is still draft, but remains
 * required once the consultation is locked.
 */
export async function rejectTheme(
  id: string,
  consultationId: string,
  rationale: string = "",
  roundId?: string
) {
  const supabase = await createClient();
  const trimmedRationale = trimToNull(rationale);

  const { data: user } = await supabase.auth.getUser();
  if (!user.user) {
    throw new Error("Not authenticated");
  }

  const [{ data: consultation, error: consultationError }, { data: theme, error: themeError }] =
    await Promise.all([
      supabase
        .from("consultations")
        .select("status")
        .eq("id", consultationId)
        .single(),
      supabase
        .from("themes")
        .select("id, label, consultation_id")
        .eq("id", id)
        .eq("consultation_id", consultationId)
        .single(),
    ]);

  if (consultationError) throw consultationError;
  if (themeError) throw themeError;

  const requiresRationale = consultation.status !== "draft";
  if (requiresRationale && !trimmedRationale) {
    throw new Error("A rejection rationale is required once the consultation is locked.");
  }

  const { data: logRecord, error: logError } = await supabase
    .from("theme_decision_logs")
    .insert({
      user_id: user.user.id,
      consultation_id: consultationId,
      theme_id: id,
      theme_label: theme.label,
      round_id: roundId || null,
      decision_type: "reject",
      rationale: trimmedRationale,
    })
    .select("id")
    .single();

  if (logError) throw logError;

  // Delete the theme
  const { error } = await supabase.from("themes").delete().eq("id", id);

  if (error) {
    await supabase.from("theme_decision_logs").delete().eq("id", logRecord.id);
    throw error;
  }

  // Emit audit event with decision metadata
  await emitAuditEvent({
    consultationId,
    action: AUDIT_ACTIONS.THEME_REJECTED,
    entityType: "theme",
    entityId: id,
    metadata: {
      decision_type: "reject",
      theme_label: theme.label,
      rationale: trimmedRationale,
      round_id: roundId || null,
    },
  });
}

/**
 * Add a user-created theme with learning signal tracking
 * User-added themes get higher weight for AI personalization
 */
export async function addUserTheme(
  consultationId: string,
  label: string,
  description?: string,
  roundId?: string
) {
  const supabase = await createClient();

  const { data: user } = await supabase.auth.getUser();
  if (!user.user) {
    throw new Error("Not authenticated");
  }

  // Insert the theme with user_added flag and higher weight
  const { data: themeData, error: insertError } = await supabase
    .from("themes")
    .insert({
      consultation_id: consultationId,
      label,
      description: description || null,
      accepted: true, // User-added themes start as accepted
      is_user_added: true,
      weight: 2.0, // Higher weight for user-added themes
    })
    .select("id")
    .single();

  if (insertError) throw insertError;

  const themeId = themeData.id;

  // Log the decision for learning signals
  const { error: logError } = await supabase
    .from("theme_decision_logs")
    .insert({
      user_id: user.user.id,
      consultation_id: consultationId,
      theme_id: themeId,
      theme_label: label,
      round_id: roundId || null,
      decision_type: "user_added",
      rationale: null,
    });

  if (logError) throw logError;

  // Emit audit event
  await emitAuditEvent({
    consultationId,
    action: AUDIT_ACTIONS.THEME_USER_ADDED,
    entityType: "theme",
    entityId: themeId,
    metadata: {
      decision_type: "user_added",
      label,
      round_id: roundId || null,
    },
  });

  return themeData;
}
