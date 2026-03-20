"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DecisionBadge } from "./decision-badge";
import { AIDraftReview } from "./ai-draft-review";
import { SourceThemeCard } from "./source-theme-card";
import type {
  RoundThemeGroup,
  ThemeMemberDetail,
  SourceTheme,
} from "@/types/round-detail";

interface ThemeGroupCardProps {
  group: RoundThemeGroup;
  selectedThemeIds: Set<string>;
  onThemeSelect: (themeId: string) => void;
  onThemeDragStart: (e: React.DragEvent, themeId: string) => void;
  onDrop: (e: React.DragEvent, groupId: string) => void;
  onLabelChange: (groupId: string, label: string) => void;
  onDescriptionChange: (groupId: string, description: string) => void;
  onAcceptDraft: (groupId: string) => void;
  onDiscardDraft: (groupId: string) => void;
  onAccept: (groupId: string) => void;
  onDiscard: (groupId: string) => void;
  onManagementReject: (groupId: string) => void;
  onSplit: (groupId: string) => void;
  mergeSelected?: boolean;
  onToggleMergeSelect?: (groupId: string) => void;
  disabled?: boolean;
}

export function ThemeGroupCard({
  group,
  selectedThemeIds,
  onThemeSelect,
  onThemeDragStart,
  onDrop,
  onLabelChange,
  onDescriptionChange,
  onAcceptDraft,
  onDiscardDraft,
  onAccept,
  onDiscard,
  onManagementReject,
  onSplit,
  mergeSelected,
  onToggleMergeSelect,
  disabled,
}: ThemeGroupCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(group.label);
  const [editDescription, setEditDescription] = useState(group.description ?? "");
  const [isDragOver, setIsDragOver] = useState(false);

  const hasLockedMembers = group.members.some((member) => member.lockedFromSource);
  const selectedMembersCount = group.members.filter((member) =>
    selectedThemeIds.has(member.insightId)
  ).length;

  function handleSaveEdit() {
    onLabelChange(group.id, editLabel);
    if (editDescription !== (group.description ?? "")) {
      onDescriptionChange(group.id, editDescription);
    }
    setIsEditing(false);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  }

  function handleDragLeave() {
    setIsDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    onDrop(e, group.id);
  }

  const isTerminal = group.status === "discarded" || group.status === "management_rejected";

  return (
    <Card
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "transition-colors",
        isDragOver && "border-primary bg-primary/5",
        mergeSelected && "ring-2 ring-blue-400",
        isTerminal && "opacity-60",
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {isEditing ? (
              <div className="space-y-2">
                <Input
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  className="h-7 text-sm"
                  placeholder="Group label"
                />
                <Input
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="h-7 text-sm"
                  placeholder="Description (optional)"
                />
                <div className="flex gap-1">
                  <Button size="sm" className="h-6 text-xs" onClick={handleSaveEdit}>
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-xs"
                    onClick={() => {
                      setIsEditing(false);
                      setEditLabel(group.label);
                      setEditDescription(group.description ?? "");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <CardTitle
                  className="text-sm cursor-pointer hover:text-primary transition-colors"
                  onClick={() => {
                    if (!isTerminal) {
                      setIsEditing(true);
                    }
                  }}
                >
                  {group.label}
                </CardTitle>
                {group.description ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {group.description}
                  </p>
                ) : null}
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <DecisionBadge status={group.status} />
            {group.origin === "ai_refined" ? (
              <Badge
                variant="outline"
                className="h-4 border-violet-200 bg-violet-50 px-1 text-[10px] text-violet-700 dark:border-violet-800 dark:bg-violet-900/40 dark:text-violet-300"
              >
                AI
              </Badge>
            ) : null}
            <Badge variant="outline" className="h-4 px-1 text-[10px]">
              {group.members.length}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-2 pt-0">
        {/* Member themes */}
        {group.members.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            Drop themes here to add them to this group
          </p>
        ) : (
          <div className="space-y-1.5">
            {group.members.map((member: ThemeMemberDetail) => {
              const adaptedTheme: SourceTheme = {
                id: member.insightId,
                sourceConsultationId: member.sourceConsultationId,
                sourceConsultationTitle: member.sourceConsultationTitle,
                label: member.label,
                description: member.description,
                editableLabel: member.label,
                editableDescription: member.description,
                lockedFromSource: member.lockedFromSource,
                isGrouped: true,
                isUserAdded: member.isUserAdded,
                groupId: group.id,
              };
              return (
                <SourceThemeCard
                  key={member.id}
                  theme={adaptedTheme}
                  selected={selectedThemeIds.has(member.insightId)}
                  onSelect={onThemeSelect}
                  onDragStart={onThemeDragStart}
                  compact
                />
              );
            })}
          </div>
        )}

        {/* AI Draft review */}
        {group.pendingDraft ? (
          <AIDraftReview
            currentLabel={group.label}
            currentDescription={group.description}
            draft={group.pendingDraft}
            onAccept={() => onAcceptDraft(group.id)}
            onDiscard={() => onDiscardDraft(group.id)}
            disabled={disabled}
          />
        ) : null}

        {/* Action bar */}
        {!isTerminal ? (
          <div className="flex flex-wrap items-center gap-1.5 border-t pt-2">
            {group.status === "draft" ? (
              <>
                <Button
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => onAccept(group.id)}
                  disabled={disabled}
                >
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-xs"
                  onClick={() => {
                    if (hasLockedMembers) {
                      onManagementReject(group.id);
                    } else {
                      onDiscard(group.id);
                    }
                  }}
                  disabled={disabled}
                >
                  {hasLockedMembers ? "Mgmt Reject" : "Discard"}
                </Button>
              </>
            ) : null}
            {selectedMembersCount > 0 ? (
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-xs"
                onClick={() => onSplit(group.id)}
                disabled={disabled}
              >
                Split selected ({selectedMembersCount})
              </Button>
            ) : null}
            {onToggleMergeSelect ? (
              <Button
                size="sm"
                variant={mergeSelected ? "default" : "outline"}
                className="h-6 text-xs"
                onClick={() => onToggleMergeSelect(group.id)}
                disabled={disabled}
              >
                {mergeSelected ? "Selected for merge" : "Select for merge"}
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
