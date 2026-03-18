"use client";

import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
import type {
  RoundThemeGroupDetail,
  RoundThemeGroupDraftState,
  SourceTheme,
} from "@/types/round-detail";
import {
  createRoundThemeGroup,
  moveThemeToGroup,
  mergeRoundThemeGroups,
  splitRoundThemeGroup,
  acceptRoundTarget,
  discardRoundTarget,
  managementRejectRoundTarget,
  acceptRoundThemeGroupDraft,
  discardRoundThemeGroupDraft,
} from "@/lib/actions/round-workflow";

interface ThemeGroupingWorkspaceProps {
  roundId: string;
  sourceThemes: SourceTheme[];
  initialGroups: RoundThemeGroupDetail[];
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
  sourceThemes,
  initialGroups,
  onStructuralChange,
}: ThemeGroupingWorkspaceProps) {
  // ─── State ─────────────────────────────────────────────────────────────────

  const [groups, setGroups] = useState<any[]>(initialGroups);
  const [selectedThemeIds, setSelectedThemeIds] = useState<Set<string>>(new Set());
  const [mergeSelectedGroupIds, setMergeSelectedGroupIds] = useState<Set<string>>(new Set());
  const [isDragOverUngrouped, setIsDragOverUngrouped] = useState(false);

  // Management rejection dialog state
  const [rejectionTarget, setRejectionTarget] = useState<{
    type: "theme" | "group";
    id: string;
    label: string;
    isLocked: boolean;
  } | null>(null);

  const queryClient = useQueryClient();

  // ─── Derived data ──────────────────────────────────────────────────────────

  const groupedThemeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const group of groups) {
      for (const member of group.members) {
        ids.add(member.themeId);
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

      setGroups((prev) => {
        // Remove from any existing group
        const cleaned = prev.map((g) => ({
          ...g,
          members: g.members.filter((m: any) => m.id !== themeId),
        }));

        // Add to target group
        return cleaned.map((g) => {
          if (g.id === targetGroupId) {
            return {
              ...g,
              members: [...g.members, { ...theme, isGrouped: true, groupId: targetGroupId }],
              lastStructuralChangeAt: new Date().toISOString(),
            };
          }
          return g;
        });
      });

      onStructuralChange?.();
    },
    [sourceThemes, onStructuralChange]
  );

  const handleDropOnUngrouped = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOverUngrouped(false);
      const themeId = e.dataTransfer.getData("text/plain");
      if (!themeId) return;

      // Remove from any group
      setGroups((prev) =>
        prev.map((g) => ({
          ...g,
          members: g.members.filter((m: any) => m.themeId !== themeId),
          lastStructuralChangeAt: g.members.some((m: any) => m.themeId === themeId)
            ? new Date().toISOString()
            : g.lastStructuralChangeAt,
        }))
      );

      onStructuralChange?.();
    },
    [onStructuralChange]
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

    void createRoundThemeGroup(
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

  function handleMergeGroups() {
    if (mergeSelectedGroupIds.size < 2) {
      toast.error("Select at least 2 groups to merge");
      return;
    }

    const toMerge = groups.filter((g) => mergeSelectedGroupIds.has(g.id));
    const allMembers = toMerge.flatMap((g) => g.members);
    const remaining = groups.filter((g) => !mergeSelectedGroupIds.has(g.id));

    const mergedGroup: any = {
      id: crypto.randomUUID(),
      label: toMerge.map((g) => g.label).join(" + "),
      description: null,
      status: "draft" as const,
      origin: "manual" as const,
      members: allMembers,
      pendingDraft: null,
      lastStructuralChangeAt: new Date().toISOString(),
      lastStructuralChangeBy: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      actorId: "",
    };

    setGroups([...remaining, mergedGroup]);
    setMergeSelectedGroupIds(new Set());
    onStructuralChange?.();
  }

  function handleSplitGroup(groupId: string) {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;

    const selectedInGroup = group.members.filter((m: any) =>
      selectedThemeIds.has(m.id)
    );
    if (selectedInGroup.length === 0) {
      toast.error("Select themes within the group to split out");
      return;
    }

    const remainingMembers = group.members.filter(
      (m: any) => !selectedThemeIds.has(m.id)
    );

    const splitGroup: any = {
      id: crypto.randomUUID(),
      label: `Split from ${group.label}`,
      description: null,
      status: "draft" as const,
      origin: "manual" as const,
      members: selectedInGroup,
      pendingDraft: null,
      lastStructuralChangeAt: new Date().toISOString(),
      lastStructuralChangeBy: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      actorId: "",
    };

    setGroups((prev) =>
      prev.map((g) => {
        if (g.id === groupId) {
          return {
            ...g,
            members: remainingMembers,
            lastStructuralChangeAt: new Date().toISOString(),
          };
        }
        return g;
      }).concat(splitGroup)
    );

    setSelectedThemeIds(new Set());
    onStructuralChange?.();
  }

  // ─── Decision handlers ─────────────────────────────────────────────────────

  function handleAcceptGroup(groupId: string) {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId ? { ...g, status: "accepted" as const } : g
      )
    );
  }

  function handleDiscardGroup(groupId: string) {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;

    const hasLocked = group.members.some((m: any) => m.lockedFromSource);
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
  }

  function handleManagementRejectGroup(groupId: string) {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    setRejectionTarget({
      type: "group",
      id: groupId,
      label: group.label,
      isLocked: group.members.some((m: any) => m.lockedFromSource),
    });
  }

  function handleRejectionConfirm(rationale: string) {
    if (!rejectionTarget) return;

    if (rejectionTarget.type === "group") {
      setGroups((prev) =>
        prev.map((g) =>
          g.id === rejectionTarget.id
            ? { ...g, status: "management_rejected" as const }
            : g
        )
      );
    }

    toast.success("Management rejection recorded");
    setRejectionTarget(null);
  }

  // ─── Label/description editing ─────────────────────────────────────────────

  function handleLabelChange(groupId: string, label: string) {
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, label } : g))
    );
    // Manual text edits do NOT trigger AI refinement
  }

  function handleDescriptionChange(groupId: string, description: string) {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId ? { ...g, description: description || null } : g
      )
    );
    // Manual text edits do NOT trigger AI refinement
  }

  // ─── Draft handlers ────────────────────────────────────────────────────────

  function handleAcceptDraft(groupId: string) {
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
  }

  function handleDiscardDraft(groupId: string) {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId ? { ...g, pendingDraft: null } : g
      )
    );
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
    </>
  );
}
