"use server";

import { createClient } from "@/lib/supabase/server";
import { callAIService } from "@/lib/openai/client";

// ─── helpers ──────────────────────────────────────────────────────────────────

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, userId: user.id };
}

// ─── Group CRUD ───────────────────────────────────────────────────────────────

/**
 * Create a new consultation group in a round.
 * label defaults to "Group N" where N is existing_count + 1.
 */
export async function createConsultationGroup(roundId: string, label?: string) {
  const { supabase, userId } = await requireUser();

  // Count existing groups to generate a default label
  let resolvedLabel = label;
  if (!resolvedLabel) {
    const { count } = await supabase
      .from("consultation_groups")
      .select("id", { count: "exact", head: true })
      .eq("round_id", roundId);
    resolvedLabel = `Group ${(count ?? 0) + 1}`;
  }

  // Position = existing count (appended at end)
  const { count: posCount } = await supabase
    .from("consultation_groups")
    .select("id", { count: "exact", head: true })
    .eq("round_id", roundId);

  const { data, error } = await supabase
    .from("consultation_groups")
    .insert({
      round_id: roundId,
      user_id: userId,
      label: resolvedLabel,
      position: posCount ?? 0,
      created_by: userId,
    })
    .select("id, label, position")
    .single();

  if (error) throw error;

  return data;
}

/**
 * Rename a consultation group.
 */
export async function updateConsultationGroup(groupId: string, label: string) {
  const { supabase } = await requireUser();

  const { error } = await supabase
    .from("consultation_groups")
    .update({ label })
    .eq("id", groupId);

  if (error) throw error;
}

/**
 * Delete a group. Members cascade-delete via FK.
 */
export async function deleteConsultationGroup(groupId: string) {
  const { supabase } = await requireUser();

  const { error } = await supabase
    .from("consultation_groups")
    .delete()
    .eq("id", groupId);

  if (error) throw error;
}

// ─── Membership ───────────────────────────────────────────────────────────────

/**
 * Assign a consultation to a group (or ungroup it by passing null).
 * If assigning to a group, upserts the membership with the given position.
 * If ungrouping (groupId = null), deletes the membership row.
 *
 * The unique(round_id, consultation_id) constraint prevents double-group membership at DB level.
 */
export async function assignConsultationToGroup(
  consultationId: string,
  roundId: string,
  groupId: string | null,
  position: number = 0
) {
  const { supabase, userId } = await requireUser();

  if (groupId === null) {
    // Ungroup: remove from any group in this round
    const { error } = await supabase
      .from("consultation_group_members")
      .delete()
      .eq("consultation_id", consultationId)
      .eq("round_id", roundId);

    if (error) throw error;
    return;
  }

  // Assign: upsert on (round_id, consultation_id)
  const { error } = await supabase
    .from("consultation_group_members")
    .upsert(
      {
        group_id: groupId,
        round_id: roundId,
        consultation_id: consultationId,
        user_id: userId,
        position,
        created_by: userId,
      },
      { onConflict: "round_id,consultation_id" }
    );

  if (error) throw error;
}

/**
 * Rewrite positions for all members of a group after a drag-and-drop reorder.
 * orderedConsultationIds must be the full ordered list of consultation IDs in the group.
 */
export async function reorderGroupMembers(
  groupId: string,
  roundId: string,
  orderedConsultationIds: string[]
) {
  const { supabase, userId } = await requireUser();

  // Fetch current members to get their IDs
  const { data: currentMembers, error: fetchError } = await supabase
    .from("consultation_group_members")
    .select("id, consultation_id")
    .eq("group_id", groupId);

  if (fetchError) throw fetchError;

  const memberIdByConsultationId = new Map(
    (currentMembers ?? []).map((m) => [m.consultation_id, m.id])
  );

  // Build upsert payload with new positions
  const updates = orderedConsultationIds.map((cId, idx) => ({
    id: memberIdByConsultationId.get(cId),
    group_id: groupId,
    round_id: roundId,
    consultation_id: cId,
    user_id: userId,
    position: idx,
    created_by: userId,
  })).filter((u) => u.id !== undefined);

  if (updates.length === 0) return;

  const { error } = await supabase
    .from("consultation_group_members")
    .upsert(updates, { onConflict: "round_id,consultation_id" });

  if (error) throw error;
}

// ─── AI actions ───────────────────────────────────────────────────────────────

export interface ConsultationThemeInput {
  consultation_id: string;
  consultation_title: string;
  theme_labels: string[];
  theme_descriptions: string[];
}

export interface SuggestedConsultationGroup {
  label: string;
  consultation_ids: string[];
  explanation: string;
}

/**
 * Ask the AI to suggest consultation groups based on selected focus themes.
 * Sends theme text inline — the AI sidecar stays stateless.
 */
export async function suggestConsultationGroups(
  roundLabel: string | null,
  selectedThemeLabels: string[],
  consultations: ConsultationThemeInput[]
): Promise<SuggestedConsultationGroup[]> {
  const result = await callAIService("/rounds/suggest-consultation-groups", {
    round_label: roundLabel,
    selected_theme_labels: selectedThemeLabels,
    consultations,
  });

  return (result.groups ?? []) as SuggestedConsultationGroup[];
}

/**
 * Generate a short evidence summary for a consultation group.
 */
export async function generateGroupSummary(
  roundLabel: string | null,
  groupLabel: string,
  consultations: ConsultationThemeInput[]
): Promise<{ title: string; content: string }> {
  const result = await callAIService("/rounds/generate-group-summary", {
    round_label: roundLabel,
    group_label: groupLabel,
    consultations,
  });

  return { title: result.title ?? groupLabel, content: result.content ?? "" };
}
