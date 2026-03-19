"use server";

import { and, asc, count, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  consultationGroupMembers,
  consultationGroups,
} from "@/db/schema";
import { requireCurrentUserId } from "@/lib/data/auth-context";
import {
  requireOwnedConsultation,
  requireOwnedConsultationGroup,
  requireOwnedRound,
} from "@/lib/data/ownership";
import { callAIService } from "@/lib/openai/client";

// ─── helpers ──────────────────────────────────────────────────────────────────

async function requireUser() {
  const userId = await requireCurrentUserId();
  return { userId };
}

// ─── Group CRUD ───────────────────────────────────────────────────────────────

/**
 * Create a new consultation group in a round.
 * label defaults to "Group N" where N is existing_count + 1.
 */
export async function createConsultationGroup(roundId: string, label?: string) {
  const { userId } = await requireUser();
  await requireOwnedRound(roundId, userId);

  // Count existing groups to generate a default label
  let resolvedLabel = label;
  if (!resolvedLabel) {
    const [{ groupCount }] = await db
      .select({ groupCount: count() })
      .from(consultationGroups)
      .where(eq(consultationGroups.roundId, roundId));
    resolvedLabel = `Group ${(groupCount ?? 0) + 1}`;
  }

  // Position = existing count (appended at end)
  const [{ positionCount }] = await db
    .select({ positionCount: count() })
    .from(consultationGroups)
    .where(eq(consultationGroups.roundId, roundId));

  const [data] = await db
    .insert(consultationGroups)
    .values({
      roundId,
      userId,
      label: resolvedLabel,
      position: positionCount ?? 0,
      createdBy: userId,
    })
    .returning({
      id: consultationGroups.id,
      label: consultationGroups.label,
      position: consultationGroups.position,
    });

  return data;
}

/**
 * Rename a consultation group.
 */
export async function updateConsultationGroup(groupId: string, label: string) {
  const { userId } = await requireUser();
  await requireOwnedConsultationGroup(groupId, userId);

  await db
    .update(consultationGroups)
    .set({ label })
    .where(and(eq(consultationGroups.id, groupId), eq(consultationGroups.userId, userId)));
}

/**
 * Delete a group. Members cascade-delete via FK.
 */
export async function deleteConsultationGroup(groupId: string) {
  const { userId } = await requireUser();
  await requireOwnedConsultationGroup(groupId, userId);

  await db
    .delete(consultationGroups)
    .where(and(eq(consultationGroups.id, groupId), eq(consultationGroups.userId, userId)));
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
  const { userId } = await requireUser();
  await requireOwnedRound(roundId, userId);
  await requireOwnedConsultation(consultationId, userId);

  if (groupId === null) {
    // Ungroup: remove from any group in this round
    await db
      .delete(consultationGroupMembers)
      .where(
        and(
          eq(consultationGroupMembers.consultationId, consultationId),
          eq(consultationGroupMembers.roundId, roundId)
        )
      );
    return;
  }

  await requireOwnedConsultationGroup(groupId, userId);

  // Assign: upsert on (round_id, consultation_id)
  await db
    .insert(consultationGroupMembers)
    .values({
        groupId,
        roundId,
        consultationId,
        userId,
        position,
        createdBy: userId,
      })
    .onConflictDoUpdate({
      target: [
        consultationGroupMembers.roundId,
        consultationGroupMembers.consultationId,
      ],
      set: {
        groupId,
        userId,
        position,
        createdBy: userId,
      },
    });
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
  const { userId } = await requireUser();
  await requireOwnedRound(roundId, userId);
  await requireOwnedConsultationGroup(groupId, userId);

  // Fetch current members to get their IDs
  const currentMembers = await db
    .select({
      id: consultationGroupMembers.id,
      consultationId: consultationGroupMembers.consultationId,
    })
    .from(consultationGroupMembers)
    .where(eq(consultationGroupMembers.groupId, groupId))
    .orderBy(asc(consultationGroupMembers.position));

  const memberIdByConsultationId = new Map(
    currentMembers.map((m) => [m.consultationId, m.id])
  );

  // Build upsert payload with new positions
  const updates = orderedConsultationIds.map((cId, idx) => ({
    id: memberIdByConsultationId.get(cId),
    groupId,
    roundId,
    consultationId: cId,
    userId,
    position: idx,
    createdBy: userId,
  })).filter((u) => u.id !== undefined);

  if (updates.length === 0) return;

  await db
    .insert(consultationGroupMembers)
    .values(updates)
    .onConflictDoUpdate({
      target: [
        consultationGroupMembers.roundId,
        consultationGroupMembers.consultationId,
      ],
      set: {
        groupId,
        userId,
        position: sql`excluded.position`,
        createdBy: userId,
      },
    });
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
