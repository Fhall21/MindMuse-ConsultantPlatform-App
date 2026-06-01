"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { GroupingThemeOption } from "@/lib/chat/tools/grouping";
import type { SourceTheme } from "@/types/round-detail";
import { SourceThemeCard } from "./source-theme-card";

export type ThemeGroupProposalMode = "propose" | "link";

function toSourceTheme(theme: GroupingThemeOption, selected: boolean): SourceTheme {
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
    isGrouped: selected,
    isUserAdded: theme.is_user_added ?? false,
    groupId: null,
  };
}

interface ThemeGroupProposalEditorProps {
  mode?: ThemeGroupProposalMode;
  groupName: string;
  groupDescription: string;
  rationale: string;
  availableThemes: GroupingThemeOption[];
  selectedThemeIds: string[];
  disabled?: boolean;
  onGroupNameChange?: (value: string) => void;
  onGroupDescriptionChange?: (value: string) => void;
  onToggleTheme: (themeId: string, selected: boolean) => void;
}

export function ThemeGroupProposalEditor({
  mode = "propose",
  groupName,
  groupDescription,
  rationale,
  availableThemes,
  selectedThemeIds,
  disabled = false,
  onGroupNameChange,
  onGroupDescriptionChange,
  onToggleTheme,
}: ThemeGroupProposalEditorProps) {
  const selectedSet = useMemo(() => new Set(selectedThemeIds), [selectedThemeIds]);

  const themesByMeeting = useMemo(() => {
    const map = new Map<string, { title: string; themes: GroupingThemeOption[] }>();
    for (const theme of availableThemes) {
      const meetingId = theme.source_meeting_id ?? "unknown";
      const title = theme.source_meeting_title ?? "Meeting";
      const existing = map.get(meetingId);
      if (existing) {
        existing.themes.push(theme);
      } else {
        map.set(meetingId, { title, themes: [theme] });
      }
    }
    return Array.from(map.entries());
  }, [availableThemes]);

  const isLinkMode = mode === "link";

  return (
    <div className="space-y-4">
      {rationale ? (
        <p className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm leading-relaxed text-muted-foreground">
          {rationale}
        </p>
      ) : null}

      <Card className="border-border/70">
        <CardHeader className="pb-3">
          {isLinkMode ? (
            <div className="space-y-1">
              <CardTitle className="text-sm">{groupName}</CardTitle>
              {groupDescription ? (
                <p className="text-xs text-muted-foreground">{groupDescription}</p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Group name</label>
                <Input
                  value={groupName}
                  disabled={disabled}
                  onChange={(event) => onGroupNameChange?.(event.target.value)}
                  placeholder="Group label"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Description</label>
                <Textarea
                  value={groupDescription}
                  disabled={disabled}
                  rows={2}
                  onChange={(event) => onGroupDescriptionChange?.(event.target.value)}
                  placeholder="Optional description"
                />
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-3 pt-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">
              {isLinkMode ? "Insights to link" : "Themes in this group"}
            </p>
            <Badge variant="outline" className="h-4 px-1 text-[10px]">
              {selectedThemeIds.length} selected
            </Badge>
          </div>

          {themesByMeeting.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No insights available to add.
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
                {themes.map((theme) => {
                  const selected = selectedSet.has(theme.id);
                  return (
                    <SourceThemeCard
                      key={theme.id}
                      theme={toSourceTheme(theme, selected)}
                      selected={selected}
                      onSelect={
                        disabled
                          ? undefined
                          : (themeId) => onToggleTheme(themeId, !selectedSet.has(themeId))
                      }
                    />
                  );
                })}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
