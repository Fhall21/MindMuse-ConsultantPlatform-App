"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { SuggestedThemeGroup } from "@/lib/actions/consultation-workflow";
import {
  CHAT_PROPOSAL_GROUP_ID,
  buildProposalThemeDetail,
  buildThemeByIdMap,
  collectGroupedInsightIds,
  existingGroupToThemeDetail,
  groupingOptionToSourceTheme,
} from "@/lib/chat/grouping-workspace-mappers";
import type { GroupingReviewOutput } from "@/lib/chat/tools/grouping";
import { AiThemeGroupSuggestionDialog } from "@/components/consultations/rounds/ai-theme-group-suggestion-dialog";
import { CreateThemeGroupDialog } from "@/components/consultations/rounds/create-theme-group-dialog";
import {
  ThemeGroupingWorkspaceLayout,
  type ThemeGroupingWorkspaceFeatures,
} from "@/components/consultations/rounds/theme-grouping-workspace-layout";
import type { SourceTheme, ThemeDetail } from "@/types/round-detail";

interface ChatThemeGroupingWorkspaceProps {
  review: GroupingReviewOutput;
  disabled?: boolean;
  onReviewChange: (next: GroupingReviewOutput) => void;
}

function groupThemesByMeeting(themes: SourceTheme[]) {
  const map = new Map<string, { title: string; themes: SourceTheme[] }>();
  for (const theme of themes) {
    const existing = map.get(theme.sourceMeetingId);
    if (existing) {
      existing.themes.push(theme);
    } else {
      map.set(theme.sourceMeetingId, {
        title: theme.sourceMeetingTitle,
        themes: [theme],
      });
    }
  }
  return Array.from(map.entries());
}

export function ChatThemeGroupingWorkspace({
  review,
  disabled = false,
  onReviewChange,
}: ChatThemeGroupingWorkspaceProps) {
  const isLinkMode = review.mode === "link";
  const [selectedThemeIds, setSelectedThemeIds] = useState<Set<string>>(
    () => new Set(review.theme_ids)
  );

  useEffect(() => {
    if (isLinkMode) {
      setSelectedThemeIds(new Set(review.theme_ids));
    }
  }, [isLinkMode, review.theme_ids]);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const existingGroups = review.existing_groups ?? [];
  const themeById = useMemo(
    () => buildThemeByIdMap(review.available_themes, existingGroups),
    [existingGroups, review.available_themes]
  );

  const groupedElsewhere = useMemo(
    () =>
      collectGroupedInsightIds(
        existingGroups,
        isLinkMode ? [] : review.theme_ids
      ),
    [existingGroups, isLinkMode, review.theme_ids]
  );

  const allSourceThemes = useMemo(
    () => review.available_themes.map(groupingOptionToSourceTheme),
    [review.available_themes]
  );

  const ungroupedThemes = useMemo(() => {
    const poolIds = isLinkMode
      ? review.available_themes.map((theme) => theme.id)
      : review.available_themes
          .map((theme) => theme.id)
          .filter((id) => !groupedElsewhere.has(id));

    return poolIds
      .map((id) => themeById.get(id))
      .filter((theme): theme is NonNullable<typeof theme> => Boolean(theme))
      .map(groupingOptionToSourceTheme);
  }, [groupedElsewhere, isLinkMode, review.available_themes, themeById]);

  const themesByMeeting = useMemo(
    () => groupThemesByMeeting(ungroupedThemes),
    [ungroupedThemes]
  );

  const activeGroups = useMemo((): ThemeDetail[] => {
    const persisted = existingGroups.map((group) =>
      existingGroupToThemeDetail(group, themeById)
    );

    if (isLinkMode) {
      return persisted;
    }

    const proposal = buildProposalThemeDetail({
      groupName: review.group_name,
      groupDescription: review.group_description,
      themeIds: review.theme_ids,
      themeById,
    });

    return [...persisted, proposal];
  }, [existingGroups, isLinkMode, review.group_description, review.group_name, review.theme_ids, themeById]);

  const features: ThemeGroupingWorkspaceFeatures = isLinkMode
    ? {
        aiGroups: false,
        createGroup: false,
        dragDrop: false,
        merge: false,
        groupDecisions: false,
        proposalEditing: false,
      }
    : {
        aiGroups: true,
        createGroup: true,
        dragDrop: false,
        merge: false,
        groupDecisions: false,
        proposalEditing: true,
      };

  const highlightGroupIds = useMemo(() => {
    if (isLinkMode && review.target_group_id) {
      return new Set([review.target_group_id]);
    }
    return new Set([CHAT_PROPOSAL_GROUP_ID]);
  }, [isLinkMode, review.target_group_id]);

  const syncSelectionToReview = useCallback(
    (nextSelected: Set<string>) => {
      setSelectedThemeIds(nextSelected);
      onReviewChange({
        ...review,
        theme_ids: Array.from(nextSelected),
      });
    },
    [onReviewChange, review]
  );

  const handleThemeSelect = useCallback(
    (themeId: string) => {
      if (disabled) return;

      if (isLinkMode) {
        const next = new Set(selectedThemeIds);
        if (next.has(themeId)) {
          next.delete(themeId);
        } else {
          next.add(themeId);
        }
        syncSelectionToReview(next);
        return;
      }

      const next = new Set(selectedThemeIds);
      if (next.has(themeId)) {
        next.delete(themeId);
      } else {
        next.add(themeId);
      }
      setSelectedThemeIds(next);
    },
    [disabled, isLinkMode, selectedThemeIds, syncSelectionToReview]
  );

  const handleCreateGroupClick = useCallback(() => {
    if (selectedThemeIds.size === 0) {
      toast.error("Select themes to group");
      return;
    }
    setCreateDialogOpen(true);
  }, [selectedThemeIds.size]);

  const handleCreateGroupConfirm = useCallback(
    (name: string, description: string) => {
      const mergedIds = Array.from(
        new Set([...review.theme_ids, ...Array.from(selectedThemeIds)])
      );
      onReviewChange({
        ...review,
        group_name: name,
        group_description: description,
        theme_ids: mergedIds,
      });
      setSelectedThemeIds(new Set());
    },
    [onReviewChange, review, selectedThemeIds]
  );

  const handleProposalLabelChange = useCallback(
    (groupId: string, label: string) => {
      if (groupId !== CHAT_PROPOSAL_GROUP_ID) return;
      onReviewChange({ ...review, group_name: label });
    },
    [onReviewChange, review]
  );

  const handleProposalDescriptionChange = useCallback(
    (groupId: string, description: string) => {
      if (groupId !== CHAT_PROPOSAL_GROUP_ID) return;
      onReviewChange({ ...review, group_description: description });
    },
    [onReviewChange, review]
  );

  const handleAcceptAiSuggestion = useCallback(
    async (suggestion: SuggestedThemeGroup) => {
      const validIds = suggestion.theme_ids.filter((id) => themeById.has(id));
      if (validIds.length < 1) {
        toast.error("Suggestion has no valid themes for this project");
        return;
      }

      onReviewChange({
        ...review,
        group_name: suggestion.label,
        group_description: suggestion.explanation,
        theme_ids: validIds,
        rationale: suggestion.explanation,
      });
      setSelectedThemeIds(new Set());
    },
    [onReviewChange, review, themeById]
  );

  const noop = useCallback(() => {}, []);

  const ungroupedForAi = useMemo(
    () =>
      review.available_themes
        .filter((theme) => !groupedElsewhere.has(theme.id))
        .map(groupingOptionToSourceTheme),
    [groupedElsewhere, review.available_themes]
  );

  return (
    <>
      <ThemeGroupingWorkspaceLayout
        heightClassName="min-h-[420px] h-[55vh] max-h-[70vh]"
        rationale={review.rationale}
        totalSourceCount={allSourceThemes.length}
        ungroupedThemes={ungroupedThemes}
        themesByMeeting={themesByMeeting}
        selectedThemeIds={selectedThemeIds}
        onThemeSelect={handleThemeSelect}
        activeGroups={activeGroups}
        features={features}
        disabled={disabled}
        onAiGroupsClick={() => setAiDialogOpen(true)}
        onCreateGroupClick={handleCreateGroupClick}
        highlightGroupIds={highlightGroupIds}
        onLabelChange={isLinkMode ? noop : handleProposalLabelChange}
        onDescriptionChange={isLinkMode ? noop : handleProposalDescriptionChange}
        onAcceptDraft={noop}
        onDiscardDraft={noop}
        onAccept={noop}
        onDiscard={noop}
        onManagementReject={noop}
        onSplit={noop}
      />

      <CreateThemeGroupDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        initialName={review.group_name}
        initialDescription={review.group_description}
        selectedCount={selectedThemeIds.size}
        onConfirm={handleCreateGroupConfirm}
      />

      {!isLinkMode ? (
        <AiThemeGroupSuggestionDialog
          open={aiDialogOpen}
          onOpenChange={setAiDialogOpen}
          roundLabel={review.consultation_label ?? null}
          sourceThemes={ungroupedForAi}
          initialSelectedIds={selectedThemeIds}
          onAcceptSuggestion={handleAcceptAiSuggestion}
        />
      ) : null}
    </>
  );
}
