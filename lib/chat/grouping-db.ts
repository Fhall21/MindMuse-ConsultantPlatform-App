import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { consultations, insights, meetings, themeMembers, themes } from "@/db/schema";
import { AUDIT_ACTIONS } from "@/lib/actions/audit-actions";
import { emitAuditEvent } from "@/lib/actions/audit";
import { requireOwnedConsultation } from "@/lib/data/ownership";
import { dispatchToolToFastApi } from "./tool-dispatch";
import { CHAT_TOOL_ENDPOINTS } from "./tool-allowlist";
import {
  buildGroupingReviewOutput,
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

export async function loadAcceptedInsightOptions(params: {
  userId: string;
  consultationId: string;
}): Promise<GroupingThemeOption[]> {
  await requireOwnedConsultation(params.consultationId, params.userId);

  const meetingRows = await db
    .select({ id: meetings.id })
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

  const insightRows = await db
    .select({
      id: insights.id,
      label: insights.label,
      description: insights.description,
    })
    .from(insights)
    .where(
      and(
        inArray(insights.meetingId, meetingIds),
        eq(insights.accepted, true),
        eq(insights.rejected, false)
      )
    )
    .orderBy(insights.createdAt);

  return insightRows.map((row) => ({
    id: row.id,
    label: row.label,
    description: row.description ?? "",
  }));
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
        consultation_title: consultation?.label ?? null,
        is_user_added: false,
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
      groupName: proposedName,
      groupDescription: proposedDescription,
      themeIds,
      rationale,
      availableThemes,
    }),
  };
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
    throw new Error("Select at least one theme for the group.");
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
        eq(insights.accepted, true)
      )
    );

  if (insightRows.length !== params.themeIds.length) {
    throw new Error("One or more themes are invalid for this consultation.");
  }

  const [created] = await db
    .insert(themes)
    .values({
      consultationId: params.consultationId,
      userId: params.userId,
      label: params.groupName.trim(),
      description: params.groupDescription.trim() || null,
      status: "accepted",
      origin: "ai_refined",
      createdBy: params.userId,
      lastStructuralChangeBy: params.userId,
    })
    .returning({ id: themes.id });

  await db.insert(themeMembers).values(
    insightRows.map((row, index) => ({
      themeId: created.id,
      consultationId: params.consultationId,
      insightId: row.id,
      sourceMeetingId: row.meetingId,
      sourceMeetingIds: row.meetingId ? [row.meetingId] : [],
      userId: params.userId,
      position: index,
      createdBy: params.userId,
    }))
  );

  await emitAuditEvent({
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
    name: params.groupName.trim(),
    description: params.groupDescription.trim(),
    themeIds: params.themeIds,
  };
}
