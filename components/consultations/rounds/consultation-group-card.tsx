"use client";

import { useState, useRef } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ChevronDown, ChevronRight, Pencil, Trash2, Check, X, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DraggableConsultationCard } from "./draggable-consultation-card";
import type { LocalGroup } from "@/hooks/use-consultation-grouping";
import type { RoundConsultationSummary } from "@/types/round-detail";
import { generateGroupSummary } from "@/lib/actions/consultation-groups";

interface ConsultationGroupCardProps {
  group: LocalGroup;
  consultations: RoundConsultationSummary[]; // full list for themeCount lookup
  selectedIds: Set<string>;
  roundLabel: string | null;
  onToggleSelect: (id: string) => void;
  onRename: (groupId: string, label: string) => Promise<void>;
  onDelete: (groupId: string) => Promise<void>;
}

export function ConsultationGroupCard({
  group,
  consultations,
  selectedIds,
  roundLabel,
  onToggleSelect,
  onRename,
  onDelete,
}: ConsultationGroupCardProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(group.label);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [groupSummary, setGroupSummary] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { setNodeRef, isOver } = useDroppable({ id: group.id });

  const consultationMap = new Map(consultations.map((c) => [c.id, c]));
  const memberIds = group.members.map((m) => m.consultationId);

  const handleRenameConfirm = async () => {
    const trimmed = editLabel.trim();
    if (!trimmed || trimmed === group.label) {
      setEditLabel(group.label);
      setIsEditing(false);
      return;
    }
    setIsEditing(false);
    await onRename(group.id, trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleRenameConfirm();
    if (e.key === "Escape") {
      setEditLabel(group.label);
      setIsEditing(false);
    }
  };

  const handleGenerateSummary = async () => {
    setIsGeneratingSummary(true);
    try {
      const memberConsultations = group.members.map((m) => {
        return {
          consultation_id: m.consultationId,
          consultation_title: m.consultationTitle,
          theme_labels: [], // themes not available at this level — FastAPI handles gracefully
          theme_descriptions: [],
        };
      });

      const result = await generateGroupSummary(roundLabel, group.label, memberConsultations);
      setGroupSummary(result.content);
    } catch {
      toast.error("Failed to generate group summary");
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  return (
    <Card
      ref={setNodeRef}
      className={isOver ? "ring-2 ring-primary ring-offset-1" : undefined}
    >
      <CardHeader className="py-3 px-4">
        <div className="flex items-center gap-2">
          {/* Collapse toggle */}
          <button
            onClick={() => setIsOpen((v) => !v)}
            className="text-muted-foreground hover:text-foreground shrink-0"
            aria-label={isOpen ? "Collapse group" : "Expand group"}
          >
            {isOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>

          {/* Label / edit */}
          {isEditing ? (
            <div className="flex flex-1 items-center gap-1">
              <Input
                ref={inputRef}
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                onKeyDown={handleKeyDown}
                className="h-7 text-sm py-0"
                autoFocus
              />
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleRenameConfirm}>
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => { setEditLabel(group.label); setIsEditing(false); }}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <span className="flex-1 text-sm font-semibold">{group.label}</span>
          )}

          <Badge variant="secondary" className="shrink-0 text-xs">
            {group.members.length} meeting{group.members.length !== 1 ? "s" : ""}
          </Badge>

          {/* Actions */}
          {!isEditing && (
            <div className="flex items-center gap-0.5 shrink-0">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => {
                  setIsEditing(true);
                  setTimeout(() => inputRef.current?.focus(), 0);
                }}
                aria-label="Rename group"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={handleGenerateSummary}
                disabled={isGeneratingSummary || group.members.length === 0}
                aria-label="Generate group summary"
              >
                {isGeneratingSummary ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileText className="h-3.5 w-3.5" />
                )}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => onDelete(group.id)}
                aria-label="Delete group"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* Inline summary display */}
        {groupSummary && (
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed border-t pt-2">
            {groupSummary}
          </p>
        )}
      </CardHeader>

      {isOpen && (
        <CardContent className="px-4 pb-4 space-y-1.5">
          <SortableContext items={memberIds} strategy={verticalListSortingStrategy}>
            {group.members.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2 text-center">
                No meetings yet — drag one here or delete this group
              </p>
            ) : (
              group.members.map((member) => {
                const c = consultationMap.get(member.consultationId);
                return (
                  <DraggableConsultationCard
                    key={member.consultationId}
                    consultationId={member.consultationId}
                    title={member.consultationTitle}
                    status={member.consultationStatus}
                    themeCount={c?.themeCount}
                    isSelected={selectedIds.has(member.consultationId)}
                    onToggleSelect={onToggleSelect}
                  />
                );
              })
            )}
          </SortableContext>
        </CardContent>
      )}
    </Card>
  );
}
