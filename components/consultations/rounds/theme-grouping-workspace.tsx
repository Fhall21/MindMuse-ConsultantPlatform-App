"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ManagementRejectionDialog } from "./management-rejection-dialog";
import { AiThemeGroupSuggestionDialog } from "./ai-theme-group-suggestion-dialog";
import { ThemeGroupingWorkspaceLayout } from "./theme-grouping-workspace-layout";
import type {
  ThemeDetail,
  ThemeMemberDetail,
  SourceTheme,
} from "@/types/round-detail";
import {
  createTheme,
  moveThemeToGroup,
  mergeThemes,
  splitTheme,
  updateTheme,
  acceptRoundTarget,
  discardRoundTarget,
  managementRejectRoundTarget,
  acceptThemeDraft,
  discardThemeDraft,
  type SuggestedThemeGroup,
} from "@/lib/actions/consultation-workflow";

const THEME_DRAG_MIME = "application/x-consultant-theme-ids";

function readDraggedThemeIds(event: React.DragEvent) {
  const payload = event.dataTransfer.getData(THEME_DRAG_MIME);
  if (payload) {
    try {
      const parsed: unknown = JSON.parse(payload);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "ids" in parsed &&
        Array.isArray((parsed as { ids: unknown[] }).ids)
      ) {
        return [
          ...new Set(
            (parsed as { ids: unknown[] }).ids.filter(
              (value: unknown): value is string => typeof value === "string"
            )
          ),
        ];
      }
    } catch {
      // Fall through to plain-text fallback.
    }
  }

  const fallback = event.dataTransfer.getData("text/plain");
  return fallback ? [fallback] : [];
}

interface ThemeGroupingWorkspaceProps {
  roundId: string;
  roundLabel?: string | null;
  sourceThemes: SourceTheme[];
  initialGroups: ThemeDetail[];
  onStructuralChange?: () => void;
}

/**
 * The main grouping workspace manages theme group operations and state.
 *
 * All mutations call Agent 1's real server actions and invalidate the
 * round detail query to keep the UI in sync with the server.
 */
export function ThemeGroupingWorkspace({
  roundId,
  roundLabel,
  sourceThemes,
  initialGroups,
  onStructuralChange,
}: ThemeGroupingWorkspaceProps) {
  // ─── State ─────────────────────────────────────────────────────────────────

  const [groups, setGroups] = useState<ThemeDetail[]>(initialGroups);
  const [selectedThemeIds, setSelectedThemeIds] = useState<Set<string>>(new Set());

  // Refs for auto-scroll on drop
  const rightColumnRef = useRef<HTMLDivElement>(null);

  // Sync local state when the server-fetched groups change (e.g. after AI group creation)
  useEffect(() => {
    setGroups(initialGroups);
  }, [initialGroups]);
  const [mergeSelectedGroupIds, setMergeSelectedGroupIds] = useState<Set<string>>(new Set());
  const [isDragOverUngrouped, setIsDragOverUngrouped] = useState(false);
  const [dragOverThemeId, setDragOverThemeId] = useState<string | null>(null);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);

  // Management rejection dialog state
  const [rejectionTarget, setRejectionTarget] = useState<{
    type: "theme" | "group";
    id: string;
    label: string;
    isLocked: boolean;
  } | null>(null);

  const queryClient = useQueryClient();
  const labelTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const descTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // ─── Derived data ──────────────────────────────────────────────────────────

  const groupedThemeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const group of groups) {
      for (const member of group.members) {
        ids.add(member.insightId);
      }
    }
    return ids;
  }, [groups]);

  const ungroupedThemes = useMemo(
    () => sourceThemes.filter((t) => !groupedThemeIds.has(t.id)),
    [sourceThemes, groupedThemeIds]
  );

  const themesByMeeting = useMemo(() => {
    const map = new Map<string, { title: string; themes: SourceTheme[] }>();
    for (const theme of ungroupedThemes) {
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
  }, [ungroupedThemes]);

  // ─── DnD handlers ──────────────────────────────────────────────────────────

  const handleDragStart = useCallback(
    (e: React.DragEvent, themeId: string) => {
      const dragIds =
        selectedThemeIds.has(themeId) && selectedThemeIds.size > 1
          ? Array.from(selectedThemeIds)
          : [themeId];

      e.dataTransfer.setData(
        THEME_DRAG_MIME,
        JSON.stringify({ ids: dragIds })
      );
      e.dataTransfer.setData("text/plain", dragIds[0] ?? themeId);
      e.dataTransfer.effectAllowed = "move";
    },
    [selectedThemeIds]
  );

  const handleDropOnGroup = useCallback(
    (e: React.DragEvent, targetGroupId: string) => {
      setDragOverThemeId(null);
      const draggedIds = readDraggedThemeIds(e);
      if (draggedIds.length === 0) return;

      const draggedThemes = sourceThemes.filter((theme) =>
        draggedIds.includes(theme.id)
      );
      if (draggedThemes.length === 0) return;

      // Optimistic update
      setGroups((prev) => {
        const cleaned = prev.map((g) => ({
          ...g,
          members: g.members.filter(
            (member: ThemeMemberDetail) => !draggedIds.includes(member.insightId)
          ),
        }));

        return cleaned.map((g) => {
          if (g.id === targetGroupId) {
            const existingIds = new Set(g.members.map((member) => member.insightId));
            return {
              ...g,
              members: [
                ...g.members,
                ...draggedThemes
                  .filter((theme) => !existingIds.has(theme.id))
                  .map(
                    (theme, index) =>
                      ({
                        id: theme.id,
                        insightId: theme.id,
                        sourceConsultationId: theme.sourceMeetingId,
                        sourceConsultationTitle: theme.sourceMeetingTitle,
                        sourceConsultationIds: theme.sourceMeetingIds,
                        sourceConsultationTitles: theme.sourceMeetingTitles,
                        label: theme.label,
                        description: theme.description,
                        lockedFromSource: theme.lockedFromSource,
                        isUserAdded: theme.isUserAdded,
                        position: g.members.length + index,
                      }) satisfies ThemeMemberDetail
                  ),
              ],
              lastStructuralChangeAt: new Date().toISOString(),
            };
          }
          return g;
        });
      });

      // Schedule auto-scroll after render
      requestAnimationFrame(() => {
        if (rightColumnRef.current) {
          const targetElement = rightColumnRef.current.querySelector(
            `[data-group-id="${targetGroupId}"]`
          );
          if (targetElement) {
            targetElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }
        }
      });

      // Persist to server
      void Promise.all(
        draggedIds.map((themeId) => moveThemeToGroup(themeId, targetGroupId))
      ).then(() => {
        queryClient.invalidateQueries({
          queryKey: ["consultation_rounds", roundId, "detail"],
        });
        setSelectedThemeIds(new Set());
        onStructuralChange?.();
      });
    },
    [sourceThemes, roundId, queryClient, onStructuralChange]
  );

  const handleDropOnUngrouped = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOverUngrouped(false);
      setDragOverThemeId(null);
      const draggedIds = readDraggedThemeIds(e);
      if (draggedIds.length === 0) return;

      const wasGrouped = groups.some((g) =>
        g.members.some((member: ThemeMemberDetail) =>
          draggedIds.includes(member.insightId)
        )
      );
      if (!wasGrouped) return;

      setGroups((prev) =>
        prev.map((g) => ({
          ...g,
          members: g.members.filter(
            (member: ThemeMemberDetail) => !draggedIds.includes(member.insightId)
          ),
          lastStructuralChangeAt: g.members.some((member: ThemeMemberDetail) =>
            draggedIds.includes(member.insightId)
          )
            ? new Date().toISOString()
            : g.lastStructuralChangeAt,
        }))
      );

      void Promise.all(
        draggedIds.map((themeId) => moveThemeToGroup(themeId, null))
      ).then(() => {
        queryClient.invalidateQueries({
          queryKey: ["consultation_rounds", roundId, "detail"],
        });
        setSelectedThemeIds(new Set());
        onStructuralChange?.();
      });
    },
    [groups, roundId, queryClient, onStructuralChange]
  );

  const handleDropOnThemeCard = useCallback(
    async (e: React.DragEvent, targetThemeId: string) => {
      const draggedIds = readDraggedThemeIds(e);
      const groupedIds = new Set<string>([
        ...draggedIds,
        targetThemeId,
      ]);
      const targetTheme = sourceThemes.find((theme) => theme.id === targetThemeId);

      setDragOverThemeId(null);
      if (!targetTheme || groupedIds.size < 2) return;
      if (groupedThemeIds.has(targetThemeId)) return;

      const themeIds = Array.from(groupedIds).filter((themeId) =>
        sourceThemes.some((theme) => theme.id === themeId)
      );
      if (themeIds.length < 2) return;

      await createTheme(roundId, themeIds);
      queryClient.invalidateQueries({
        queryKey: ["consultation_rounds", roundId, "detail"],
      });
      setSelectedThemeIds(new Set());
      onStructuralChange?.();
    },
    [groupedThemeIds, onStructuralChange, queryClient, roundId, sourceThemes]
  );

  // ─── Theme selection ───────────────────────────────────────────────────────

  const handleThemeSelect = useCallback((themeId: string) => {
    setSelectedThemeIds((prev) => {
      const next = new Set(prev);
      if (next.has(themeId)) {
        next.delete(themeId);
      } else {
        next.add(themeId);
      }
      return next;
    });
  }, []);

  // ─── Group operations ──────────────────────────────────────────────────────

  function handleCreateGroup() {
    const selectedUngrouped = ungroupedThemes.filter((t) =>
      selectedThemeIds.has(t.id)
    );

    if (selectedUngrouped.length === 0) {
      toast.error("Select themes to group");
      return;
    }

    void createTheme(
      roundId,
      selectedUngrouped.map((t) => t.id)
    ).then(() => {
      queryClient.invalidateQueries({
        queryKey: ["consultation_rounds", roundId, "detail"],
      });
      setSelectedThemeIds(new Set());
      onStructuralChange?.();
    });
  }

  async function handleAcceptAiSuggestion(suggestion: SuggestedThemeGroup) {
    // theme_ids in the suggestion are sourceTheme IDs — pass them directly to createTheme
    const validThemeIds = suggestion.theme_ids.filter((id) =>
      sourceThemes.some((t) => t.id === id)
    );
    if (validThemeIds.length < 2) {
      toast.error("Suggestion contains fewer than 2 valid themes — skipping");
      return;
    }
    await createTheme(roundId, validThemeIds, true);
    queryClient.invalidateQueries({
      queryKey: ["consultation_rounds", roundId, "detail"],
    });
    onStructuralChange?.();
  }

  async function handleMergeGroups() {
    if (mergeSelectedGroupIds.size < 2) {
      toast.error("Select at least 2 groups to merge");
      return;
    }

    try {
      await mergeThemes(roundId, Array.from(mergeSelectedGroupIds));
      setMergeSelectedGroupIds(new Set());
      setSelectedThemeIds(new Set());
      invalidateDetail();
      onStructuralChange?.();
    } catch {
      toast.error("Failed to merge groups");
    }
  }

  async function handleSplitGroup(groupId: string) {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;

    const selectedThemeIdsInGroup = group.members
      .filter((member: ThemeMemberDetail) => selectedThemeIds.has(member.insightId))
      .map((member: ThemeMemberDetail) => member.insightId);

    if (selectedThemeIdsInGroup.length === 0) {
      toast.error("Select themes within the group to split out");
      return;
    }

    try {
      await splitTheme(groupId, selectedThemeIdsInGroup);
      setSelectedThemeIds(new Set());
      invalidateDetail();
      onStructuralChange?.();
    } catch {
      toast.error("Failed to split group");
    }
  }

  // ─── Decision handlers ─────────────────────────────────────────────────────

  function invalidateDetail() {
    queryClient.invalidateQueries({
      queryKey: ["consultation_rounds", roundId, "detail"],
    });
  }

  async function handleAcceptGroup(groupId: string) {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId ? { ...g, status: "accepted" as const } : g
      )
    );
    try {
      await acceptRoundTarget("theme_group", groupId);
      invalidateDetail();
    } catch {
      toast.error("Failed to accept group");
      invalidateDetail(); // revert optimistic update
    }
  }

  async function handleDiscardGroup(groupId: string) {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;

    const hasLocked = group.members.some((member: ThemeMemberDetail) => member.lockedFromSource);
    if (hasLocked) {
      setRejectionTarget({
        type: "group",
        id: groupId,
        label: group.label,
        isLocked: true,
      });
      return;
    }

    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId ? { ...g, status: "discarded" as const } : g
      )
    );
    try {
      await discardRoundTarget("theme_group", groupId);
      invalidateDetail();
    } catch {
      toast.error("Failed to discard group");
      invalidateDetail();
    }
  }

  function handleManagementRejectGroup(groupId: string) {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    setRejectionTarget({
      type: "group",
      id: groupId,
      label: group.label,
      isLocked: group.members.some((member: ThemeMemberDetail) => member.lockedFromSource),
    });
  }

  async function handleRejectionConfirm(rationale: string) {
    if (!rejectionTarget) return;

    if (rejectionTarget.type === "group") {
      setGroups((prev) =>
        prev.map((g) =>
          g.id === rejectionTarget.id
            ? { ...g, status: "management_rejected" as const }
            : g
        )
      );
      try {
        await managementRejectRoundTarget("theme_group", rejectionTarget.id, rationale);
        invalidateDetail();
      } catch {
        toast.error("Failed to record management rejection");
        invalidateDetail();
      }
    }

    toast.success("Management rejection recorded");
    setRejectionTarget(null);
  }

  // ─── Label/description editing ─────────────────────────────────────────────

  function handleLabelChange(groupId: string, label: string) {
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, label } : g))
    );
    // Debounce: persist 800ms after last keystroke
    const existing = labelTimers.current.get(groupId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      void updateTheme(groupId, { label })
        .then(invalidateDetail)
        .catch(() => toast.error("Failed to save label"));
      labelTimers.current.delete(groupId);
    }, 800);
    labelTimers.current.set(groupId, timer);
  }

  function handleDescriptionChange(groupId: string, description: string) {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId ? { ...g, description: description || null } : g
      )
    );
    // Debounce: persist 800ms after last keystroke
    const existing = descTimers.current.get(groupId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      void updateTheme(groupId, { description: description || null })
        .then(invalidateDetail)
        .catch(() => toast.error("Failed to save description"));
      descTimers.current.delete(groupId);
    }, 800);
    descTimers.current.set(groupId, timer);
  }

  // ─── Draft handlers ────────────────────────────────────────────────────────

  async function handleAcceptDraft(groupId: string) {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id === groupId && g.pendingDraft) {
          return {
            ...g,
            label: g.pendingDraft.draftLabel,
            description: g.pendingDraft.draftDescription,
            pendingDraft: null,
          };
        }
        return g;
      })
    );
    try {
      await acceptThemeDraft(groupId);
      invalidateDetail();
    } catch {
      toast.error("Failed to accept AI draft");
      invalidateDetail();
    }
  }

  async function handleDiscardDraft(groupId: string) {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId ? { ...g, pendingDraft: null } : g
      )
    );
    try {
      await discardThemeDraft(groupId);
      invalidateDetail();
    } catch {
      toast.error("Failed to discard AI draft");
      invalidateDetail();
    }
  }

  // ─── Merge selection ───────────────────────────────────────────────────────

  function handleToggleMergeSelect(groupId: string) {
    setMergeSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const activeGroups = groups.filter(
    (g) => g.status !== "discarded" && g.status !== "management_rejected"
  );
  const terminalGroups = groups.filter(
    (g) => g.status === "discarded" || g.status === "management_rejected"
  );

  return (
    <>
      <ThemeGroupingWorkspaceLayout
        totalSourceCount={sourceThemes.length}
        ungroupedThemes={ungroupedThemes}
        themesByMeeting={themesByMeeting}
        selectedThemeIds={selectedThemeIds}
        onThemeSelect={handleThemeSelect}
        activeGroups={activeGroups}
        terminalGroups={terminalGroups}
        onAiGroupsClick={() => setAiDialogOpen(true)}
        onCreateGroupClick={handleCreateGroup}
        mergeSelectedGroupIds={mergeSelectedGroupIds}
        onToggleMergeSelect={handleToggleMergeSelect}
        onMergeGroups={handleMergeGroups}
        onDragStart={handleDragStart}
        onDropOnUngrouped={handleDropOnUngrouped}
        onDragOverUngroupedZone={() => {
          setIsDragOverUngrouped(true);
          setDragOverThemeId(null);
        }}
        onDropOnThemeCard={handleDropOnThemeCard}
        onDropOnGroup={handleDropOnGroup}
        onDragOverCard={setDragOverThemeId}
        onDragLeaveCard={() => {
          setDragOverThemeId(null);
          setIsDragOverUngrouped(false);
        }}
        dragOverThemeId={dragOverThemeId}
        isDragOverUngrouped={isDragOverUngrouped}
        onLabelChange={handleLabelChange}
        onDescriptionChange={handleDescriptionChange}
        onAcceptDraft={handleAcceptDraft}
        onDiscardDraft={handleDiscardDraft}
        onAccept={handleAcceptGroup}
        onDiscard={handleDiscardGroup}
        onManagementReject={handleManagementRejectGroup}
        onSplit={handleSplitGroup}
        rightColumnRef={rightColumnRef}
      />

      <ManagementRejectionDialog
        open={rejectionTarget !== null}
        targetLabel={rejectionTarget?.label ?? ""}
        targetType={rejectionTarget?.type ?? "group"}
        isLocked={rejectionTarget?.isLocked}
        onConfirm={handleRejectionConfirm}
        onCancel={() => setRejectionTarget(null)}
      />

      <AiThemeGroupSuggestionDialog
        open={aiDialogOpen}
        onOpenChange={setAiDialogOpen}
        roundLabel={roundLabel ?? null}
        sourceThemes={ungroupedThemes}
        initialSelectedIds={selectedThemeIds}
        onAcceptSuggestion={handleAcceptAiSuggestion}
      />
    </>
  );
}
