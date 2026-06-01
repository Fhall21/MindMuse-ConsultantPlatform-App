import { and, eq, inArray, ne, notInArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  consultations,
  insights,
  meetings,
  themeMembers,
  themes,
} from "@/db/schema";
import { AUDIT_ACTIONS } from "@/lib/actions/audit-actions";
import { insertAuditLogEntry } from "@/lib/data/audit-log";
import { requireOwnedConsultation } from "@/lib/data/ownership";
import { dispatchToolToFastApi } from "./tool-dispatch";
import { CHAT_TOOL_ENDPOINTS } from "./tool-allowlist";
import {
  buildGroupingReviewOutput,
  type GroupingExistingGroup,
  type GroupingThemeOption,
  type ThemeGroupRecord,
} from "./tools/grouping";

function normalizeHintTokens(hint?: string): string[] {
  if (!hint?.trim()) {
    return [];
  }
  return hint
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function pickFocusLabels(
  hint: string | undefined,
  options: GroupingThemeOption[]
): string[] {
  if (options.length < 2) {
    return options.map((item) => item.label);
  }

  const tokens = normalizeHintTokens(hint);
  if (tokens.length === 0) {
    return options.slice(0, Math.min(options.length, 3)).map((item) => item.label);
  }

  const matched = options.filter((item) => {
    const haystack = `${item.label} ${item.description}`.toLowerCase();
    return tokens.some((token) => haystack.includes(token));
  });

  const focus = matched.length >= 2 ? matched : options;
  return focus.slice(0, Math.min(focus.length, 5)).map((item) => item.label);
}

function pickThemeIdsByHint(
  hint: string | undefined,
  options: GroupingThemeOption[]
): string[] {
  const tokens = normalizeHintTokens(hint);
  if (tokens.length === 0) {
    return [];
  }

  return options
    .filter((item) => {
      const haystack = `${item.label} ${item.description}`.toLowerCase();
      return tokens.some((token) => haystack.includes(token));
    })
    .map((item) => item.id);
}

function normalizeGroupName(value: string): string {
  return value.trim().toLowerCase();
}

export async function loadAcceptedInsightOptions(params: {
  userId: string;
  consultationId: string;
  excludeInsightIds?: string[];
}): Promise<GroupingThemeOption[]> {
  await requireOwnedConsultation(params.consultationId, params.userId);

  const meetingRows = await db
    .select({ id: meetings.id, title: meetings.title })
    .from(meetings)
    .where(
      and(
        eq(meetings.userId, params.userId),
        eq(meetings.consultationId, params.consultationId),
        eq(meetings.isArchived, false)
      )
    );

  const meetingIds = meetingRows.map((row) => row.id);
  if (meetingIds.length === 0) {
    return [];
  }

  const meetingTitleById = new Map(meetingRows.map((row) => [row.id, row.title]));

  const insightRows = await db
    .select({
      id: insights.id,
      label: insights.label,
      description: insights.description,
      meetingId: insights.meetingId,
      isUserAdded: insights.isUserAdded,
    })
    .from(insights)
    .where(
      and(
        inArray(insights.meetingId, meetingIds),
        eq(insights.accepted, true),
        eq(insights.rejected, false),
        params.excludeInsightIds && params.excludeInsightIds.length > 0
          ? notInArray(insights.id, params.excludeInsightIds)
          : undefined
      )
    )
    .orderBy(insights.createdAt);

  return insightRows.map((row) => ({
    id: row.id,
    label: row.label,
    description: row.description ?? "",
    source_meeting_id: row.meetingId,
    source_meeting_title: meetingTitleById.get(row.meetingId) ?? "Meeting",
    is_user_added: row.isUserAdded,
  }));
}

async function loadGroupedInsightIds(params: {
  consultationId: string;
  excludeGroupId?: string;
}): Promise<Set<string>> {
  const memberRows = await db
    .select({ insightId: themeMembers.insightId, themeId: themeMembers.themeId })
    .from(themeMembers)
    .where(eq(themeMembers.consultationId, params.consultationId));

  const grouped = new Set<string>();
  for (const row of memberRows) {
    if (params.excludeGroupId && row.themeId === params.excludeGroupId) {
      continue;
    }
    grouped.add(row.insightId);
  }
  return grouped;
}

export async function loadGroupingExistingGroups(params: {
  userId: string;
  consultationId: string;
  excludeGroupId?: string;
}): Promise<GroupingExistingGroup[]> {
  await requireOwnedConsultation(params.consultationId, params.userId);

  const groupRows = await db
    .select({
      id: themes.id,
      label: themes.label,
      description: themes.description,
      status: themes.status,
      origin: themes.origin,
      aiDraftLabel: themes.aiDraftLabel,
      aiDraftDescription: themes.aiDraftDescription,
      aiDraftExplanation: themes.aiDraftExplanation,
      aiDraftCreatedAt: themes.aiDraftCreatedAt,
      aiDraftCreatedBy: themes.aiDraftCreatedBy,
      lastStructuralChangeAt: themes.lastStructuralChangeAt,
      createdAt: themes.createdAt,
      updatedAt: themes.updatedAt,
      createdBy: themes.createdBy,
    })
    .from(themes)
    .where(
      and(
        eq(themes.consultationId, params.consultationId),
        eq(themes.userId, params.userId),
        sql`${themes.status} not in ('discarded', 'management_rejected')`,
        params.excludeGroupId ? ne(themes.id, params.excludeGroupId) : undefined
      )
    )
    .orderBy(themes.createdAt);

  if (groupRows.length === 0) {
    return [];
  }

  const memberRows = await db
    .select({
      themeId: themeMembers.themeId,
      insightId: themeMembers.insightId,
      label: insights.label,
      description: insights.description,
      meetingId: insights.meetingId,
      isUserAdded: insights.isUserAdded,
    })
    .from(themeMembers)
    .innerJoin(insights, eq(themeMembers.insightId, insights.id))
    .where(eq(themeMembers.consultationId, params.consultationId))
    .orderBy(themeMembers.position);

  const meetingRows = await db
    .select({ id: meetings.id, title: meetings.title })
    .from(meetings)
    .where(
      and(
        eq(meetings.userId, params.userId),
        eq(meetings.consultationId, params.consultationId),
        eq(meetings.isArchived, false)
      )
    );

  const meetingTitleById = new Map(meetingRows.map((row) => [row.id, row.title]));
  const membersByGroupId = new Map<string, GroupingThemeOption[]>();

  for (const row of memberRows) {
    const members = membersByGroupId.get(row.themeId) ?? [];
    members.push({
      id: row.insightId,
      label: row.label,
      description: row.description ?? "",
      source_meeting_id: row.meetingId,
      source_meeting_title: meetingTitleById.get(row.meetingId) ?? "Meeting",
      is_user_added: row.isUserAdded,
    });
    membersByGroupId.set(row.themeId, members);
  }

  return groupRows.map((group) => {
    const members = membersByGroupId.get(group.id) ?? [];
    const hasDraft =
      Boolean(group.aiDraftLabel?.trim()) || Boolean(group.aiDraftDescription?.trim());

    return {
      id: group.id,
      label: group.label,
      description: group.description ?? "",
      status: group.status,
      origin: group.origin,
      member_insight_ids: members.map((member) => member.id),
      members,
      pending_draft: hasDraft
        ? {
            draft_label: group.aiDraftLabel?.trim() || group.label,
            draft_description:
              group.aiDraftDescription?.trim() || group.description || "",
            draft_explanation: group.aiDraftExplanation ?? null,
            created_at: group.aiDraftCreatedAt?.toISOString() ?? null,
            created_by: group.aiDraftCreatedBy ?? null,
          }
        : null,
      last_structural_change_at: group.lastStructuralChangeAt?.toISOString(),
      created_at: group.createdAt?.toISOString(),
      updated_at: group.updatedAt?.toISOString(),
      created_by: group.createdBy ?? undefined,
    } satisfies GroupingExistingGroup;
  });
}

async function findThemeGroup(params: {
  userId: string;
  consultationId: string;
  groupName: string;
  groupId?: string;
}) {
  const conditions = [
    eq(themes.consultationId, params.consultationId),
    eq(themes.userId, params.userId),
    sql`${themes.status} not in ('discarded', 'management_rejected')`,
  ];

  if (params.groupId) {
    const [byId] = await db
      .select({
        id: themes.id,
        label: themes.label,
        description: themes.description,
      })
      .from(themes)
      .where(and(...conditions, eq(themes.id, params.groupId)))
      .limit(1);
    return byId ?? null;
  }

  const rows = await db
    .select({
      id: themes.id,
      label: themes.label,
      description: themes.description,
    })
    .from(themes)
    .where(and(...conditions));

  const normalized = normalizeGroupName(params.groupName);
  const exact = rows.find((row) => normalizeGroupName(row.label) === normalized);
  if (exact) {
    return exact;
  }

  return (
    rows.find((row) => normalizeGroupName(row.label).includes(normalized)) ??
    rows.find((row) => normalized.includes(normalizeGroupName(row.label))) ??
    null
  );
}

export async function executeGroupThemesTool(params: {
  userId: string;
  sessionId: string;
  consultationId: string;
  hint?: string;
}): Promise<
  | { ok: true; output: ReturnType<typeof buildGroupingReviewOutput> }
  | { ok: false; error: string }
> {
  const availableThemes = await loadAcceptedInsightOptions({
    userId: params.userId,
    consultationId: params.consultationId,
  });

  if (availableThemes.length < 2) {
    return {
      ok: false,
      error: "Accept at least two themes before grouping.",
    };
  }

  const [consultation] = await db
    .select({ label: consultations.label })
    .from(consultations)
    .where(
      and(
        eq(consultations.id, params.consultationId),
        eq(consultations.userId, params.userId)
      )
    )
    .limit(1);

  const existingGroups = await loadGroupingExistingGroups({
    userId: params.userId,
    consultationId: params.consultationId,
  });

  const focusLabels = pickFocusLabels(params.hint, availableThemes);
  const result = await dispatchToolToFastApi({
    userId: params.userId,
    sessionId: params.sessionId,
    endpoint: CHAT_TOOL_ENDPOINTS.group_themes,
    body: {
      round_label: consultation?.label ?? "Consultation",
      focus_theme_labels: focusLabels,
      source_themes: availableThemes.map((theme) => ({
        theme_id: theme.id,
        label: theme.label,
        description: theme.description || null,
        consultation_title: theme.source_meeting_title ?? null,
        is_user_added: theme.is_user_added ?? false,
      })),
    },
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  const groupsRaw =
    result.data && typeof result.data === "object" && "groups" in result.data
      ? (result.data as { groups?: unknown }).groups
      : null;

  const firstGroup =
    Array.isArray(groupsRaw) && groupsRaw.length > 0 && typeof groupsRaw[0] === "object"
      ? (groupsRaw[0] as Record<string, unknown>)
      : null;

  const proposedName =
    typeof firstGroup?.label === "string" ? firstGroup.label : "Suggested group";
  const proposedDescription =
    typeof firstGroup?.explanation === "string" ? firstGroup.explanation : "";
  const rationale =
    typeof firstGroup?.explanation === "string"
      ? firstGroup.explanation
      : params.hint
        ? `Grouped themes matching "${params.hint}".`
        : "AI-suggested theme cluster.";

  const proposedIds = Array.isArray(firstGroup?.theme_ids)
    ? firstGroup.theme_ids.filter((id): id is string => typeof id === "string")
    : [];
  const validIds = new Set(availableThemes.map((theme) => theme.id));
  const themeIds =
    proposedIds.filter((id) => validIds.has(id)).length >= 2
      ? proposedIds.filter((id) => validIds.has(id))
      : availableThemes.slice(0, Math.min(availableThemes.length, 3)).map((theme) => theme.id);

  return {
    ok: true,
    output: buildGroupingReviewOutput({
      consultationId: params.consultationId,
      mode: "propose",
      groupName: proposedName,
      groupDescription: proposedDescription,
      themeIds,
      rationale,
      availableThemes,
      existingGroups,
      consultationLabel: consultation?.label ?? undefined,
    }),
  };
}

export async function executeLinkInsightsToGroupTool(params: {
  userId: string;
  consultationId: string;
  groupName: string;
  groupId?: string;
  hint?: string;
  insightIds?: string[];
}): Promise<
  | { ok: true; output: ReturnType<typeof buildGroupingReviewOutput> }
  | { ok: false; error: string }
> {
  await requireOwnedConsultation(params.consultationId, params.userId);

  const group = await findThemeGroup({
    userId: params.userId,
    consultationId: params.consultationId,
    groupName: params.groupName,
    groupId: params.groupId,
  });

  if (!group) {
    return {
      ok: false,
      error: `No theme group named "${params.groupName}" found in this consultation.`,
    };
  }

  const alreadyInGroup = await db
    .select({ insightId: themeMembers.insightId })
    .from(themeMembers)
    .where(
      and(
        eq(themeMembers.consultationId, params.consultationId),
        eq(themeMembers.themeId, group.id)
      )
    );

  const excludeIds = alreadyInGroup.map((row) => row.insightId);
  const groupedElsewhere = await loadGroupedInsightIds({
    consultationId: params.consultationId,
    excludeGroupId: group.id,
  });

  const availableThemes = (
    await loadAcceptedInsightOptions({
      userId: params.userId,
      consultationId: params.consultationId,
      excludeInsightIds: excludeIds,
    })
  ).filter((theme) => !groupedElsewhere.has(theme.id));

  if (availableThemes.length === 0) {
    return {
      ok: false,
      error: "No ungrouped insights are available to link to this group.",
    };
  }

  const validIds = new Set(availableThemes.map((theme) => theme.id));
  const requestedIds = (params.insightIds ?? []).filter((id) => validIds.has(id));
  const hintedIds = pickThemeIdsByHint(params.hint, availableThemes);
  const themeIds =
    requestedIds.length > 0
      ? requestedIds
      : hintedIds.length > 0
        ? hintedIds
        : availableThemes.slice(0, Math.min(availableThemes.length, 5)).map((theme) => theme.id);

  const rationale = params.hint
    ? `Link insights matching "${params.hint}" to "${group.label}".`
    : `Select insights to add to "${group.label}".`;

  const existingGroups = await loadGroupingExistingGroups({
    userId: params.userId,
    consultationId: params.consultationId,
  });

  const [consultation] = await db
    .select({ label: consultations.label })
    .from(consultations)
    .where(
      and(
        eq(consultations.id, params.consultationId),
        eq(consultations.userId, params.userId)
      )
    )
    .limit(1);

  return {
    ok: true,
    output: buildGroupingReviewOutput({
      consultationId: params.consultationId,
      mode: "link",
      groupName: group.label,
      groupDescription: group.description ?? "",
      themeIds,
      rationale,
      availableThemes,
      existingGroups,
      targetGroupId: group.id,
      consultationLabel: consultation?.label ?? undefined,
    }),
  };
}

export class ThemeGroupingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ThemeGroupingValidationError";
  }
}

export async function confirmGroupingFromChat(params: {
  userId: string;
  consultationId: string;
  groupName: string;
  groupDescription: string;
  themeIds: string[];
}): Promise<ThemeGroupRecord> {
  await requireOwnedConsultation(params.consultationId, params.userId);

  if (params.themeIds.length === 0) {
    throw new ThemeGroupingValidationError("Select at least one theme for the group.");
  }

  const insightRows = await db
    .select({
      id: insights.id,
      meetingId: insights.meetingId,
    })
    .from(insights)
    .innerJoin(meetings, eq(insights.meetingId, meetings.id))
    .where(
      and(
        inArray(insights.id, params.themeIds),
        eq(meetings.userId, params.userId),
        eq(meetings.consultationId, params.consultationId),
        eq(meetings.isArchived, false),
        eq(insights.accepted, true),
        eq(insights.rejected, false)
      )
    );

  if (insightRows.length !== params.themeIds.length) {
    throw new ThemeGroupingValidationError(
      "One or more themes are invalid for this consultation."
    );
  }

  const groupName = params.groupName.trim();
  const groupDescription = params.groupDescription.trim();

  const created = await db.transaction(async (tx) => {
    await tx
      .delete(themeMembers)
      .where(
        and(
          eq(themeMembers.consultationId, params.consultationId),
          inArray(themeMembers.insightId, params.themeIds)
        )
      );

    const [group] = await tx
      .insert(themes)
      .values({
        consultationId: params.consultationId,
        userId: params.userId,
        label: groupName,
        description: groupDescription || null,
        status: "accepted",
        origin: "ai_refined",
        createdBy: params.userId,
        lastStructuralChangeBy: params.userId,
      })
      .returning({ id: themes.id });

    await tx.insert(themeMembers).values(
      insightRows.map((row, index) => ({
        themeId: group.id,
        consultationId: params.consultationId,
        insightId: row.id,
        sourceMeetingId: row.meetingId,
        sourceMeetingIds: row.meetingId ? [row.meetingId] : [],
        userId: params.userId,
        position: index,
        createdBy: params.userId,
      }))
    );

    return group;
  });

  const auditMeetingId = insightRows.find((row) => row.meetingId)?.meetingId ?? null;

  await insertAuditLogEntry({
    userId: params.userId,
    consultationId: auditMeetingId,
    action: AUDIT_ACTIONS.ROUND_THEME_GROUP_CREATED,
    entityType: "round_theme_group",
    entityId: created.id,
    metadata: {
      round_id: params.consultationId,
      seed_theme_ids: params.themeIds,
      source: "chat_confirm_grouping",
    },
  });

  return {
    id: created.id,
    name: groupName,
    description: groupDescription,
    themeIds: params.themeIds,
  };
}

export async function linkInsightsToGroupFromChat(params: {
  userId: string;
  consultationId: string;
  groupId: string;
  themeIds: string[];
}): Promise<ThemeGroupRecord> {
  await requireOwnedConsultation(params.consultationId, params.userId);

  if (params.themeIds.length === 0) {
    throw new ThemeGroupingValidationError("Select at least one insight to link.");
  }

  const [group] = await db
    .select({
      id: themes.id,
      label: themes.label,
      description: themes.description,
    })
    .from(themes)
    .where(
      and(
        eq(themes.id, params.groupId),
        eq(themes.consultationId, params.consultationId),
        eq(themes.userId, params.userId)
      )
    )
    .limit(1);

  if (!group) {
    throw new ThemeGroupingValidationError("Theme group not found.");
  }

  const insightRows = await db
    .select({
      id: insights.id,
      meetingId: insights.meetingId,
    })
    .from(insights)
    .innerJoin(meetings, eq(insights.meetingId, meetings.id))
    .where(
      and(
        inArray(insights.id, params.themeIds),
        eq(meetings.userId, params.userId),
        eq(meetings.consultationId, params.consultationId),
        eq(meetings.isArchived, false),
        eq(insights.accepted, true),
        eq(insights.rejected, false)
      )
    );

  if (insightRows.length !== params.themeIds.length) {
    throw new ThemeGroupingValidationError(
      "One or more insights are invalid for this consultation."
    );
  }

  const existingMembers = await db
    .select({ insightId: themeMembers.insightId, position: themeMembers.position })
    .from(themeMembers)
    .where(eq(themeMembers.themeId, params.groupId));

  const existingInsightIds = new Set(existingMembers.map((row) => row.insightId));
  const nextPosition =
    existingMembers.reduce((max, row) => Math.max(max, row.position), -1) + 1;

  const newRows = insightRows.filter((row) => !existingInsightIds.has(row.id));
  if (newRows.length === 0) {
    throw new ThemeGroupingValidationError(
      "Selected insights are already linked to this group."
    );
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(themeMembers)
      .where(
        and(
          eq(themeMembers.consultationId, params.consultationId),
          inArray(
            themeMembers.insightId,
            newRows.map((row) => row.id)
          )
        )
      );

    await tx.insert(themeMembers).values(
      newRows.map((row, index) => ({
        themeId: params.groupId,
        consultationId: params.consultationId,
        insightId: row.id,
        sourceMeetingId: row.meetingId,
        sourceMeetingIds: row.meetingId ? [row.meetingId] : [],
        userId: params.userId,
        position: nextPosition + index,
        createdBy: params.userId,
      }))
    );

    await tx
      .update(themes)
      .set({
        lastStructuralChangeAt: new Date(),
        lastStructuralChangeBy: params.userId,
      })
      .where(eq(themes.id, params.groupId));
  });

  const linkedIds = [
    ...existingMembers.map((row) => row.insightId),
    ...newRows.map((row) => row.id),
  ];

  const auditMeetingId = newRows.find((row) => row.meetingId)?.meetingId ?? null;

  await insertAuditLogEntry({
    userId: params.userId,
    consultationId: auditMeetingId,
    action: AUDIT_ACTIONS.ROUND_THEME_GROUP_MEMBER_MOVED,
    entityType: "round_theme_group",
    entityId: params.groupId,
    metadata: {
      round_id: params.consultationId,
      linked_insight_ids: newRows.map((row) => row.id),
      source: "chat_link_insights_to_group",
    },
  });

  return {
    id: group.id,
    name: group.label,
    description: group.description ?? "",
    themeIds: linkedIds,
  };
}
