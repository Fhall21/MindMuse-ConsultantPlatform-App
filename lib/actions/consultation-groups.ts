"use server";

import { and, asc, count, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  consultationGroupMembers,
  meetingGroups,
} from "@/db/schema";
import { requireCurrentUserId } from "@/lib/data/auth-context";
import {
  requireOwnedConsultation,
  requireOwnedConsultationGroup,
  requireOwnedMeeting,
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
 * Create a new meeting group in a consultation (grouping).
 * label defaults to "Group N" where N is existing_count + 1.
 */
export async function createConsultationGroup(consultationId: string, label?: string) {
  const { userId } = await requireUser();
  await requireOwnedRound(consultationId, userId);

  // Count existing groups to generate a default label
  let resolvedLabel = label;
  if (!resolvedLabel) {
    const [{ groupCount }] = await db
      .select({ groupCount: count() })
      .from(meetingGroups)
      .where(eq(meetingGroups.consultationId, consultationId));
    resolvedLabel = `Group ${(groupCount ?? 0) + 1}`;
  }

  // Position = existing count (appended at end)
  const [{ positionCount }] = await db
    .select({ positionCount: count() })
    .from(meetingGroups)
    .where(eq(meetingGroups.consultationId, consultationId));

  const [data] = await db
    .insert(meetingGroups)
    .values({
      consultationId,
      userId,
      label: resolvedLabel,
      position: positionCount ?? 0,
      createdBy: userId,
    })
    .returning({
      id: meetingGroups.id,
      label: meetingGroups.label,
      position: meetingGroups.position,
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
    .update(meetingGroups)
    .set({ label })
    .where(and(eq(meetingGroups.id, groupId), eq(meetingGroups.userId, userId)));
}

/**
 * Delete a group. Members cascade-delete via FK.
 */
export async function deleteConsultationGroup(groupId: string) {
  const { userId } = await requireUser();
  await requireOwnedConsultationGroup(groupId, userId);

  await db
    .delete(meetingGroups)
    .where(and(eq(meetingGroups.id, groupId), eq(meetingGroups.userId, userId)));
}

// ─── Membership ───────────────────────────────────────────────────────────────

/**
 * Assign a meeting to a group (or ungroup it by passing null).
 * If assigning to a group, upserts the membership with the given position.
 * If ungrouping (groupId = null), deletes the membership row.
 *
 * The unique(consultation_id, meeting_id) constraint prevents double-group membership at DB level.
 */
export async function assignConsultationToGroup(
  meetingId: string,
  consultationId: string,
  groupId: string | null,
  position: number = 0
) {
  const { userId } = await requireUser();
  await requireOwnedRound(consultationId, userId);
  await requireOwnedMeeting(meetingId, userId);

  if (groupId === null) {
    // Ungroup: remove from any group in this consultation
    await db
      .delete(consultationGroupMembers)
      .where(
        and(
          eq(consultationGroupMembers.meetingId, meetingId),
          eq(consultationGroupMembers.consultationId, consultationId)
        )
      );
    return;
  }

  await requireOwnedConsultationGroup(groupId, userId);

  // Assign: upsert on (consultation_id, meeting_id)
  await db
    .insert(consultationGroupMembers)
    .values({
        groupId,
        consultationId,
        meetingId,
        userId,
        position,
        createdBy: userId,
      })
    .onConflictDoUpdate({
      target: [
        consultationGroupMembers.consultationId,
        consultationGroupMembers.meetingId,
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
 * orderedMeetingIds must be the full ordered list of meeting IDs in the group.
 */
export async function reorderGroupMembers(
  groupId: string,
  consultationId: string,
  orderedMeetingIds: string[]
) {
  const { userId } = await requireUser();
  await requireOwnedRound(consultationId, userId);
  await requireOwnedConsultationGroup(groupId, userId);

  // Fetch current members to get their IDs
  const currentMembers = await db
    .select({
      id: consultationGroupMembers.id,
      meetingId: consultationGroupMembers.meetingId,
    })
    .from(consultationGroupMembers)
    .where(eq(consultationGroupMembers.groupId, groupId))
    .orderBy(asc(consultationGroupMembers.position));

  const memberIdByMeetingId = new Map(
    currentMembers.map((m) => [m.meetingId, m.id])
  );

  // Build upsert payload with new positions
  const updates = orderedMeetingIds.map((mId, idx) => ({
    id: memberIdByMeetingId.get(mId),
    groupId,
    consultationId,
    meetingId: mId,
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
        consultationGroupMembers.consultationId,
        consultationGroupMembers.meetingId,
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
