"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { SourceThemeCard } from "./source-theme-card";
import { ThemeGroupCard } from "./theme-group-card";
import { ManagementRejectionDialog } from "./management-rejection-dialog";
import { AiThemeGroupSuggestionDialog } from "./ai-theme-group-suggestion-dialog";
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
} from "@/lib/actions/round-workflow";

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

  // Sync local state when the server-fetched groups change (e.g. after AI group creation)
  useEffect(() => {
    setGroups(initialGroups);
  }, [initialGroups]);
  const [mergeSelectedGroupIds, setMergeSelectedGroupIds] = useState<Set<string>>(new Set());
  const [isDragOverUngrouped, setIsDragOverUngrouped] = useState(false);
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

  const themesByConsultation = useMemo(() => {
    const map = new Map<string, { title: string; themes: SourceTheme[] }>();
    for (const theme of ungroupedThemes) {
      const existing = map.get(theme.sourceConsultationId);
      if (existing) {
        existing.themes.push(theme);
      } else {
        map.set(theme.sourceConsultationId, {
          title: theme.sourceConsultationTitle,
          themes: [theme],
        });
      }
    }
    return Array.from(map.entries());
  }, [ungroupedThemes]);

  // ─── DnD handlers ──────────────────────────────────────────────────────────

  const handleDragStart = useCallback((e: React.DragEvent, themeId: string) => {
    e.dataTransfer.setData("text/plain", themeId);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDropOnGroup = useCallback(
    (e: React.DragEvent, targetGroupId: string) => {
      const themeId = e.dataTransfer.getData("text/plain");
      if (!themeId) return;

      const theme = sourceThemes.find((t) => t.id === themeId);
      if (!theme) return;

      // Optimistic update
      setGroups((prev) => {
        // Remove from any existing group (use themeId, not member row id)
        const cleaned = prev.map((g) => ({
          ...g,
          members: g.members.filter((member: ThemeMemberDetail) => member.insightId !== themeId),
        }));

        // Add to target group
        return cleaned.map((g) => {
          if (g.id === targetGroupId) {
            return {
              ...g,
              members: [
                ...g.members,
                {
                  id: theme.id,
                  insightId: theme.id,
                  sourceConsultationId: theme.sourceConsultationId,
                  sourceConsultationTitle: theme.sourceConsultationTitle,
                  label: theme.label,
                  description: theme.description,
                  lockedFromSource: theme.lockedFromSource,
                  isUserAdded: theme.isUserAdded,
                  position: g.members.length,
                } satisfies ThemeMemberDetail,
              ],
              lastStructuralChangeAt: new Date().toISOString(),
            };
          }
          return g;
        });
      });

      // Persist to server
      void moveThemeToGroup(themeId, targetGroupId).then(() => {
        queryClient.invalidateQueries({
          queryKey: ["consultation_rounds", roundId, "detail"],
        });
        onStructuralChange?.();
      });
    },
    [sourceThemes, roundId, queryClient, onStructuralChange]
  );

  const handleDropOnUngrouped = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOverUngrouped(false);
      const themeId = e.dataTransfer.getData("text/plain");
      if (!themeId) return;

      // Only act if the theme was actually in a group
      const wasGrouped = groups.some((g) =>
        g.members.some((member: ThemeMemberDetail) => member.insightId === themeId)
      );
      if (!wasGrouped) return;

      // Optimistic update — remove from all groups
      setGroups((prev) =>
        prev.map((g) => ({
          ...g,
          members: g.members.filter((member: ThemeMemberDetail) => member.insightId !== themeId),
          lastStructuralChangeAt: g.members.some((member: ThemeMemberDetail) => member.insightId === themeId)
            ? new Date().toISOString()
            : g.lastStructuralChangeAt,
        }))
      );

      // Persist: null target = ungroup
      void moveThemeToGroup(themeId, null).then(() => {
        queryClient.invalidateQueries({
          queryKey: ["consultation_rounds", roundId, "detail"],
        });
        onStructuralChange?.();
      });
    },
    [groups, roundId, queryClient, onStructuralChange]
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
    await createTheme(roundId, validThemeIds);
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
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Source themes pool (ungrouped) */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">Source Themes</CardTitle>
                <CardDescription>
                  {ungroupedThemes.length} ungrouped &middot;{" "}
                  {sourceThemes.length} total
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAiDialogOpen(true)}
                  disabled={ungroupedThemes.length < 2}
                  className="gap-1.5"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  AI Groups
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreateGroup}
                  disabled={ungroupedThemes.length === 0}
                >
                  Create Group
                  {selectedThemeIds.size > 0 ? (
                    <span className="ml-1">({selectedThemeIds.size})</span>
                  ) : null}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOverUngrouped(true);
            }}
            onDragLeave={() => setIsDragOverUngrouped(false)}
            onDrop={handleDropOnUngrouped}
            className={cn(
              "space-y-4 transition-colors",
              isDragOverUngrouped && "bg-accent/30",
            )}
          >
            {themesByConsultation.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                All themes are grouped. Drag themes here to ungroup them.
              </p>
            ) : (
              themesByConsultation.map(([consultationId, { title, themes }]) => (
                <div key={consultationId} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-border/60" />
                    <span className="text-xs font-medium text-muted-foreground">
                      {title}
                    </span>
                    <Badge variant="outline" className="h-4 px-1 text-[10px]">
                      {themes.length}
                    </Badge>
                    <div className="h-px flex-1 bg-border/60" />
                  </div>
                  {themes.map((theme) => (
                    <SourceThemeCard
                      key={theme.id}
                      theme={theme}
                      selected={selectedThemeIds.has(theme.id)}
                      onSelect={handleThemeSelect}
                      onDragStart={handleDragStart}
                    />
                  ))}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Right: Theme groups */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold">Theme Groups</h3>
              <p className="text-sm text-muted-foreground">
                {activeGroups.length} active group{activeGroups.length !== 1 ? "s" : ""}
              </p>
            </div>
            {mergeSelectedGroupIds.size >= 2 ? (
              <Button size="sm" onClick={handleMergeGroups}>
                Merge {mergeSelectedGroupIds.size} groups
              </Button>
            ) : null}
          </div>

          {activeGroups.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-sm text-muted-foreground">
                  No groups yet. Select themes and click &ldquo;Create Group&rdquo;,
                  or drag themes from the source pool.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {activeGroups.map((group) => (
                <ThemeGroupCard
                  key={group.id}
                  group={group}
                  selectedThemeIds={selectedThemeIds}
                  onThemeSelect={handleThemeSelect}
                  onThemeDragStart={handleDragStart}
                  onDrop={handleDropOnGroup}
                  onLabelChange={handleLabelChange}
                  onDescriptionChange={handleDescriptionChange}
                  onAcceptDraft={handleAcceptDraft}
                  onDiscardDraft={handleDiscardDraft}
                  onAccept={handleAcceptGroup}
                  onDiscard={handleDiscardGroup}
                  onManagementReject={handleManagementRejectGroup}
                  onSplit={handleSplitGroup}
                  mergeSelected={mergeSelectedGroupIds.has(group.id)}
                  onToggleMergeSelect={handleToggleMergeSelect}
                />
              ))}
            </div>
          )}

          {/* Terminal groups (discarded / management rejected) */}
          {terminalGroups.length > 0 ? (
            <div className="space-y-2">
              <h4 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Excluded
              </h4>
              {terminalGroups.map((group) => (
                <ThemeGroupCard
                  key={group.id}
                  group={group}
                  selectedThemeIds={selectedThemeIds}
                  onThemeSelect={handleThemeSelect}
                  onThemeDragStart={handleDragStart}
                  onDrop={handleDropOnGroup}
                  onLabelChange={handleLabelChange}
                  onDescriptionChange={handleDescriptionChange}
                  onAcceptDraft={handleAcceptDraft}
                  onDiscardDraft={handleDiscardDraft}
                  onAccept={handleAcceptGroup}
                  onDiscard={handleDiscardGroup}
                  onManagementReject={handleManagementRejectGroup}
                  onSplit={handleSplitGroup}
                  disabled
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>

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
        onAcceptSuggestion={handleAcceptAiSuggestion}
      />
    </>
  );
}
