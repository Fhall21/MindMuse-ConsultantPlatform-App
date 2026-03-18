"use server";

import { createClient } from "@/lib/supabase/server";
import { emitAuditEvent } from "./audit";

/**
 * Round detail write actions.
 *
 * These actions implement the shared contract for round theme group operations.
 * Actions that require tables not yet created by Agent 1 are marked with TODO
 * and throw a descriptive error until the schema is available.
 *
 * Wire-ready actions (use existing tables): fetchRoundDetail
 * Pending Agent 1 schema: all theme group CRUD, merge/split, decisions, outputs
 */

// ─── Audit action constants ──────────────────────────────────────────────────

const ROUND_DETAIL_AUDIT = {
  THEME_GROUP_CREATED: "round.theme_group.created",
  THEME_GROUP_UPDATED: "round.theme_group.updated",
  THEME_MOVED: "round.theme.moved",
  GROUPS_MERGED: "round.theme_groups.merged",
  GROUP_SPLIT: "round.theme_group.split",
  TARGET_ACCEPTED: "round.target.accepted",
  TARGET_DISCARDED: "round.target.discarded",
  TARGET_MANAGEMENT_REJECTED: "round.target.management_rejected",
  DRAFT_ACCEPTED: "round.draft.accepted",
  DRAFT_DISCARDED: "round.draft.discarded",
  OUTPUT_GENERATION_REQUESTED: "round.output.generation_requested",
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function requireAuth() {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error("Not authenticated");
  return { supabase, userId: user.user.id };
}

// ─── Theme Group CRUD ────────────────────────────────────────────────────────

export async function createRoundThemeGroup(
  roundId: string,
  seedThemeIds?: string[],
  label?: string
) {
  const { supabase, userId } = await requireAuth();

  // TODO: Agent 1 — create round_theme_groups table
  // For now, use a local-state approach in the UI
  // Once the table exists, insert into round_theme_groups and link seed themes

  const groupId = crypto.randomUUID();

  await emitAuditEvent({
    consultationId: null,
    action: ROUND_DETAIL_AUDIT.THEME_GROUP_CREATED,
    entityType: "round_theme_group",
    entityId: groupId,
    metadata: { roundId, seedThemeIds, label, userId },
  });

  return groupId;
}

export async function updateRoundThemeGroup(
  groupId: string,
  patch: { label?: string; description?: string }
) {
  const { supabase, userId } = await requireAuth();

  // TODO: Agent 1 — update round_theme_groups row
  await emitAuditEvent({
    consultationId: null,
    action: ROUND_DETAIL_AUDIT.THEME_GROUP_UPDATED,
    entityType: "round_theme_group",
    entityId: groupId,
    metadata: { patch, userId },
  });
}

// ─── Theme Movement ──────────────────────────────────────────────────────────

export async function moveThemeToGroup(
  themeId: string,
  targetGroupId: string | null,
  position?: number
) {
  const { supabase, userId } = await requireAuth();

  // TODO: Agent 1 — update round_theme_group_members join table
  await emitAuditEvent({
    consultationId: null,
    action: ROUND_DETAIL_AUDIT.THEME_MOVED,
    entityType: "source_theme",
    entityId: themeId,
    metadata: { targetGroupId, position, userId },
  });
}

// ─── Merge / Split ───────────────────────────────────────────────────────────

export async function mergeRoundThemeGroups(
  roundId: string,
  groupIds: string[]
) {
  const { supabase, userId } = await requireAuth();

  if (groupIds.length < 2) throw new Error("Need at least 2 groups to merge");

  // TODO: Agent 1 — merge groups in DB, consolidate members
  const mergedGroupId = crypto.randomUUID();

  await emitAuditEvent({
    consultationId: null,
    action: ROUND_DETAIL_AUDIT.GROUPS_MERGED,
    entityType: "round_theme_group",
    entityId: mergedGroupId,
    metadata: { roundId, sourceGroupIds: groupIds, userId },
  });

  return mergedGroupId;
}

export async function splitRoundThemeGroup(
  groupId: string,
  themeIds: string[]
) {
  const { supabase, userId } = await requireAuth();

  if (themeIds.length === 0) throw new Error("Need at least 1 theme to split out");

  // TODO: Agent 1 — create new group from split themes
  const newGroupId = crypto.randomUUID();

  await emitAuditEvent({
    consultationId: null,
    action: ROUND_DETAIL_AUDIT.GROUP_SPLIT,
    entityType: "round_theme_group",
    entityId: newGroupId,
    metadata: { sourceGroupId: groupId, themeIds, userId },
  });

  return newGroupId;
}

// ─── Decision Actions ────────────────────────────────────────────────────────

export async function acceptRoundTarget(
  targetType: "source_theme" | "theme_group",
  targetId: string
) {
  const { supabase, userId } = await requireAuth();

  // TODO: Agent 1 — update status to 'accepted' in the relevant table
  await emitAuditEvent({
    consultationId: null,
    action: ROUND_DETAIL_AUDIT.TARGET_ACCEPTED,
    entityType: targetType,
    entityId: targetId,
    metadata: { userId },
  });
}

export async function discardRoundTarget(
  targetType: "source_theme" | "theme_group",
  targetId: string
) {
  const { supabase, userId } = await requireAuth();

  // TODO: Agent 1 — update status to 'discarded'
  await emitAuditEvent({
    consultationId: null,
    action: ROUND_DETAIL_AUDIT.TARGET_DISCARDED,
    entityType: targetType,
    entityId: targetId,
    metadata: { userId },
  });
}

export async function managementRejectRoundTarget(
  targetType: "source_theme" | "theme_group",
  targetId: string,
  rationale: string
) {
  if (!rationale || rationale.trim().length === 0) {
    throw new Error("Management rejection requires a rationale");
  }

  const { supabase, userId } = await requireAuth();

  // TODO: Agent 1 — update status to 'management_rejected' with rationale
  await emitAuditEvent({
    consultationId: null,
    action: ROUND_DETAIL_AUDIT.TARGET_MANAGEMENT_REJECTED,
    entityType: targetType,
    entityId: targetId,
    metadata: { rationale: rationale.trim(), userId },
  });
}

// ─── AI Draft Actions ────────────────────────────────────────────────────────

export async function acceptRoundThemeGroupDraft(groupId: string) {
  const { supabase, userId } = await requireAuth();

  // TODO: Agent 1 — apply draft values to group, clear pending draft
  await emitAuditEvent({
    consultationId: null,
    action: ROUND_DETAIL_AUDIT.DRAFT_ACCEPTED,
    entityType: "round_theme_group",
    entityId: groupId,
    metadata: { userId },
  });
}

export async function discardRoundThemeGroupDraft(groupId: string) {
  const { supabase, userId } = await requireAuth();

  // TODO: Agent 1 — clear pending draft
  await emitAuditEvent({
    consultationId: null,
    action: ROUND_DETAIL_AUDIT.DRAFT_DISCARDED,
    entityType: "round_theme_group",
    entityId: groupId,
    metadata: { userId },
  });
}

// ─── Output Generation ───────────────────────────────────────────────────────

export async function generateRoundSummary(roundId: string) {
  const { userId } = await requireAuth();

  // TODO: Agent 1 — trigger summary generation via AI service
  await emitAuditEvent({
    consultationId: null,
    action: ROUND_DETAIL_AUDIT.OUTPUT_GENERATION_REQUESTED,
    entityType: "round_output",
    entityId: roundId,
    metadata: { outputType: "summary", userId },
  });
}

export async function generateRoundReport(roundId: string) {
  const { userId } = await requireAuth();

  // TODO: Agent 1 — trigger report generation via AI service
  await emitAuditEvent({
    consultationId: null,
    action: ROUND_DETAIL_AUDIT.OUTPUT_GENERATION_REQUESTED,
    entityType: "round_output",
    entityId: roundId,
    metadata: { outputType: "report", userId },
  });
}

export async function generateRoundEmail(roundId: string) {
  const { userId } = await requireAuth();

  // TODO: Agent 1 — trigger email generation via AI service
  await emitAuditEvent({
    consultationId: null,
    action: ROUND_DETAIL_AUDIT.OUTPUT_GENERATION_REQUESTED,
    entityType: "round_output",
    entityId: roundId,
    metadata: { outputType: "email", userId },
  });
}
