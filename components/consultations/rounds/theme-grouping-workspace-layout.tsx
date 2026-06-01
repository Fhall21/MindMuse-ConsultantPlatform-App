"use client";

import type { ReactNode } from "react";
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
import type { SourceTheme, ThemeDetail } from "@/types/round-detail";

export interface ThemeGroupingWorkspaceFeatures {
  aiGroups?: boolean;
  createGroup?: boolean;
  dragDrop?: boolean;
  merge?: boolean;
  groupDecisions?: boolean;
  proposalEditing?: boolean;
}

export interface ThemeGroupingWorkspaceLayoutProps {
  className?: string;
  heightClassName?: string;
  rationale?: ReactNode;
  totalSourceCount: number;
  ungroupedThemes: SourceTheme[];
  themesByMeeting: Array<[string, { title: string; themes: SourceTheme[] }]>;
  selectedThemeIds: Set<string>;
  onThemeSelect: (themeId: string) => void;
  activeGroups: ThemeDetail[];
  terminalGroups?: ThemeDetail[];
  features?: ThemeGroupingWorkspaceFeatures;
  disabled?: boolean;
  onAiGroupsClick?: () => void;
  onCreateGroupClick?: () => void;
  mergeSelectedGroupIds?: Set<string>;
  onToggleMergeSelect?: (groupId: string) => void;
  onMergeGroups?: () => void;
  onDragStart?: (e: React.DragEvent, themeId: string) => void;
  onDropOnUngrouped?: (e: React.DragEvent) => void;
  onDragOverUngroupedZone?: () => void;
  onDropOnThemeCard?: (e: React.DragEvent, themeId: string) => void;
  onDropOnGroup?: (e: React.DragEvent, groupId: string) => void;
  onDragOverCard?: (themeId: string) => void;
  onDragLeaveCard?: () => void;
  dragOverThemeId?: string | null;
  isDragOverUngrouped?: boolean;
  onLabelChange?: (groupId: string, label: string) => void;
  onDescriptionChange?: (groupId: string, description: string) => void;
  onAcceptDraft?: (groupId: string) => void;
  onDiscardDraft?: (groupId: string) => void;
  onAccept?: (groupId: string) => void;
  onDiscard?: (groupId: string) => void;
  onManagementReject?: (groupId: string) => void;
  onSplit?: (groupId: string) => void;
  rightColumnRef?: React.RefObject<HTMLDivElement | null>;
  highlightGroupIds?: Set<string>;
}

const DEFAULT_FEATURES: Required<ThemeGroupingWorkspaceFeatures> = {
  aiGroups: true,
  createGroup: true,
  dragDrop: true,
  merge: true,
  groupDecisions: true,
  proposalEditing: true,
};

export function ThemeGroupingWorkspaceLayout({
  className,
  heightClassName = "h-[70vh]",
  rationale,
  totalSourceCount,
  ungroupedThemes,
  themesByMeeting,
  selectedThemeIds,
  onThemeSelect,
  activeGroups,
  terminalGroups = [],
  features: featuresProp,
  disabled = false,
  onAiGroupsClick,
  onCreateGroupClick,
  mergeSelectedGroupIds,
  onToggleMergeSelect,
  onMergeGroups,
  onDragStart,
  onDropOnUngrouped,
  onDragOverUngroupedZone,
  onDropOnThemeCard,
  onDropOnGroup,
  onDragOverCard,
  onDragLeaveCard,
  dragOverThemeId,
  isDragOverUngrouped,
  onLabelChange,
  onDescriptionChange,
  onAcceptDraft,
  onDiscardDraft,
  onAccept,
  onDiscard,
  onManagementReject,
  onSplit,
  rightColumnRef,
  highlightGroupIds,
}: ThemeGroupingWorkspaceLayoutProps) {
  const features = { ...DEFAULT_FEATURES, ...featuresProp };
  const dragEnabled = features.dragDrop && !disabled;
  const mergeCount = mergeSelectedGroupIds?.size ?? 0;

  return (
    <div className={cn("space-y-3", className)}>
      {rationale ? (
        <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm leading-relaxed text-muted-foreground">
          {rationale}
        </div>
      ) : null}

      <div
        className={cn(
          "overflow-hidden rounded-lg border border-border",
          heightClassName
        )}
      >
        <div className="grid h-full gap-0 lg:grid-cols-2">
          <Card className="scroll-zone flex flex-col rounded-none border-r border-border lg:border-r">
            <CardHeader className="sticky top-0 z-10 border-b bg-card">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Source Themes</CardTitle>
                  <CardDescription>
                    {ungroupedThemes.length} ungrouped &middot; {totalSourceCount} total
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  {features.aiGroups ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={onAiGroupsClick}
                      disabled={disabled || ungroupedThemes.length < 2}
                      className="gap-1.5"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      AI Groups
                    </Button>
                  ) : null}
                  {features.createGroup ? (
                    <Button
                      size="sm"
                      onClick={onCreateGroupClick}
                      disabled={disabled || selectedThemeIds.size === 0}
                    >
                      Create Group
                      {selectedThemeIds.size > 0 ? (
                        <span className="ml-1">({selectedThemeIds.size})</span>
                      ) : null}
                    </Button>
                  ) : null}
                </div>
              </div>
            </CardHeader>
            <CardContent
              onDragOver={
                dragEnabled && onDropOnUngrouped
                  ? (event) => {
                      event.preventDefault();
                      onDragOverUngroupedZone?.();
                    }
                  : undefined
              }
              onDragLeave={dragEnabled ? onDragLeaveCard : undefined}
              onDrop={dragEnabled ? onDropOnUngrouped : undefined}
              className={cn(
                "flex-1 space-y-4 overflow-y-auto transition-colors",
                isDragOverUngrouped && "bg-accent/30"
              )}
            >
              {themesByMeeting.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  All themes are grouped. Drag themes here to ungroup them.
                </p>
              ) : (
                themesByMeeting.map(([meetingId, { title, themes }]) => (
                  <div key={meetingId} className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="h-px flex-1 bg-border/60" />
                      <span className="text-xs font-medium text-muted-foreground">{title}</span>
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
                        onSelect={disabled ? undefined : onThemeSelect}
                        onDragStart={dragEnabled ? onDragStart : undefined}
                        onDragOverCard={dragEnabled ? onDragOverCard : undefined}
                        onDragLeaveCard={dragEnabled ? onDragLeaveCard : undefined}
                        onDropOnCard={dragEnabled ? onDropOnThemeCard : undefined}
                        dropTarget={dragOverThemeId === theme.id}
                      />
                    ))}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <div className="scroll-zone flex flex-col overflow-hidden border-l border-border lg:border-l">
            <div className="sticky top-0 z-10 border-b border-border bg-background px-6 py-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold">Theme Groups</h3>
                  <p className="text-sm text-muted-foreground">
                    {activeGroups.length} active group{activeGroups.length !== 1 ? "s" : ""}
                  </p>
                </div>
                {features.merge && mergeCount >= 2 ? (
                  <Button size="sm" onClick={onMergeGroups} disabled={disabled}>
                    Merge {mergeCount} groups
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div ref={rightColumnRef} className="space-y-4">
                {activeGroups.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <p className="text-sm text-muted-foreground">
                        No groups yet. Select themes and click &ldquo;Create Group&rdquo;, or drag
                        themes from the source pool.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {activeGroups.map((group) => (
                      <div
                        key={group.id}
                        data-group-id={group.id}
                        className={cn(
                          highlightGroupIds?.has(group.id) &&
                            "rounded-lg ring-2 ring-primary/40 ring-offset-2"
                        )}
                      >
                        <ThemeGroupCard
                          group={group}
                          selectedThemeIds={selectedThemeIds}
                          onThemeSelect={onThemeSelect}
                          onThemeDragStart={dragEnabled ? onDragStart : undefined}
                          onDrop={dragEnabled && onDropOnGroup ? onDropOnGroup : undefined}
                          onLabelChange={
                            features.proposalEditing ? onLabelChange : undefined
                          }
                          onDescriptionChange={
                            features.proposalEditing ? onDescriptionChange : undefined
                          }
                          onAcceptDraft={onAcceptDraft}
                          onDiscardDraft={onDiscardDraft}
                          onAccept={features.groupDecisions ? onAccept : undefined}
                          onDiscard={features.groupDecisions ? onDiscard : undefined}
                          onManagementReject={
                            features.groupDecisions ? onManagementReject : undefined
                          }
                          onSplit={features.groupDecisions ? onSplit : undefined}
                          mergeSelected={mergeSelectedGroupIds?.has(group.id)}
                          onToggleMergeSelect={
                            features.merge ? onToggleMergeSelect : undefined
                          }
                          disabled={
                            disabled ||
                            (!features.proposalEditing &&
                              highlightGroupIds !== undefined &&
                              !highlightGroupIds.has(group.id))
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}

                {terminalGroups.length > 0 ? (
                  <div className="mt-4 space-y-2 border-t pt-4">
                    <h4 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                      Excluded
                    </h4>
                    {terminalGroups.map((group) => (
                      <div key={group.id} data-group-id={group.id}>
                        <ThemeGroupCard
                          group={group}
                          selectedThemeIds={selectedThemeIds}
                          onThemeSelect={onThemeSelect}
                          onThemeDragStart={dragEnabled ? onDragStart : undefined}
                          onDrop={dragEnabled && onDropOnGroup ? onDropOnGroup : undefined}
                          onLabelChange={onLabelChange}
                          onDescriptionChange={onDescriptionChange}
                          onAcceptDraft={onAcceptDraft}
                          onDiscardDraft={onDiscardDraft}
                          onAccept={onAccept}
                          onDiscard={onDiscard}
                          onManagementReject={onManagementReject}
                          onSplit={onSplit}
                          disabled
                        />
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
