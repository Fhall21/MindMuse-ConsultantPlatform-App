import type { GroupingExistingGroup, GroupingThemeOption } from "@/lib/chat/tools/grouping";
import type { SourceTheme, ThemeDetail, ThemeMemberDetail } from "@/types/round-detail";

export const CHAT_PROPOSAL_GROUP_ID = "__chat_proposal__";

export function groupingOptionToSourceTheme(theme: GroupingThemeOption): SourceTheme {
  const meetingId = theme.source_meeting_id ?? "";
  const meetingTitle = theme.source_meeting_title ?? "Meeting";

  return {
    id: theme.id,
    sourceMeetingId: meetingId,
    sourceMeetingTitle: meetingTitle,
    sourceMeetingIds: meetingId ? [meetingId] : [],
    sourceMeetingTitles: meetingTitle ? [meetingTitle] : [],
    label: theme.label,
    description: theme.description || null,
    editableLabel: theme.label,
    editableDescription: theme.description || null,
    lockedFromSource: false,
    isGrouped: false,
    isUserAdded: theme.is_user_added ?? false,
    groupId: null,
  };
}

function memberFromOption(
  theme: GroupingThemeOption,
  position: number
): ThemeMemberDetail {
  const meetingId = theme.source_meeting_id ?? "";
  const meetingTitle = theme.source_meeting_title ?? "Meeting";

  return {
    id: theme.id,
    insightId: theme.id,
    sourceConsultationId: meetingId,
    sourceConsultationTitle: meetingTitle,
    sourceConsultationIds: meetingId ? [meetingId] : [],
    sourceConsultationTitles: meetingTitle ? [meetingTitle] : [],
    label: theme.label,
    description: theme.description || null,
    lockedFromSource: false,
    isUserAdded: theme.is_user_added ?? false,
    position,
  };
}

export function existingGroupToThemeDetail(
  group: GroupingExistingGroup,
  themeById: Map<string, GroupingThemeOption>
): ThemeDetail {
  const members = group.member_insight_ids
    .map((insightId, index) => {
      const theme = themeById.get(insightId);
      if (!theme) {
        return null;
      }
      return memberFromOption(theme, index);
    })
    .filter((member): member is ThemeMemberDetail => member !== null);

  const now = new Date().toISOString();

  return {
    id: group.id,
    label: group.label,
    description: group.description || null,
    status: group.status,
    origin: group.origin,
    currentGroup: {
      label: group.label,
      description: group.description || null,
      origin: group.origin,
      status: group.status,
    },
    pendingDraft: group.pending_draft
      ? {
          draftLabel: group.pending_draft.draft_label,
          draftDescription: group.pending_draft.draft_description,
          draftExplanation: group.pending_draft.draft_explanation ?? null,
          createdAt: group.pending_draft.created_at ?? null,
          createdBy: group.pending_draft.created_by ?? null,
        }
      : null,
    members,
    memberCount: members.length,
    lastStructuralChangeAt: group.last_structural_change_at ?? now,
    lastStructuralChangeBy: null,
    createdAt: group.created_at ?? now,
    updatedAt: group.updated_at ?? now,
    actorId: group.created_by ?? "",
  };
}

export function buildProposalThemeDetail(params: {
  groupName: string;
  groupDescription: string;
  themeIds: string[];
  themeById: Map<string, GroupingThemeOption>;
}): ThemeDetail {
  const members = params.themeIds
    .map((insightId, index) => {
      const theme = params.themeById.get(insightId);
      if (!theme) {
        return null;
      }
      return memberFromOption(theme, index);
    })
    .filter((member): member is ThemeMemberDetail => member !== null);

  const now = new Date().toISOString();

  return {
    id: CHAT_PROPOSAL_GROUP_ID,
    label: params.groupName,
    description: params.groupDescription || null,
    status: "draft",
    origin: "ai_refined",
    currentGroup: {
      label: params.groupName,
      description: params.groupDescription || null,
      origin: "ai_refined",
      status: "draft",
    },
    pendingDraft: null,
    members,
    memberCount: members.length,
    lastStructuralChangeAt: now,
    lastStructuralChangeBy: null,
    createdAt: now,
    updatedAt: now,
    actorId: "",
  };
}

export function buildThemeByIdMap(
  availableThemes: GroupingThemeOption[],
  existingGroups: GroupingExistingGroup[] = []
): Map<string, GroupingThemeOption> {
  const map = new Map<string, GroupingThemeOption>();
  for (const theme of availableThemes) {
    map.set(theme.id, theme);
  }
  for (const group of existingGroups) {
    for (const member of group.members ?? []) {
      map.set(member.id, member);
    }
  }
  return map;
}

export function collectGroupedInsightIds(
  existingGroups: GroupingExistingGroup[],
  extraIds: string[] = []
): Set<string> {
  const ids = new Set<string>(extraIds);
  for (const group of existingGroups) {
    for (const insightId of group.member_insight_ids) {
      ids.add(insightId);
    }
  }
  return ids;
}
