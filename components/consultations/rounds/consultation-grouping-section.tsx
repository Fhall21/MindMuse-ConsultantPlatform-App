"use client";

import { useState } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { Plus, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DraggableConsultationCard } from "./draggable-consultation-card";
import { ConsultationGroupCard } from "./consultation-group-card";
import { AiGroupSuggestionDialog } from "./ai-group-suggestion-dialog";
import { useConsultationGrouping } from "@/hooks/use-consultation-grouping";
import type {
  ConsultationGroupDetail,
  RoundConsultationSummary,
  SourceTheme,
} from "@/types/round-detail";
import type { SuggestedConsultationGroup } from "@/lib/actions/consultation-groups";

// ─── Ungrouped droppable area ─────────────────────────────────────────────────

function UngroupedDropZone({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: "ungrouped" });
  return (
    <div
      ref={setNodeRef}
      className={`space-y-1.5 min-h-[2rem] rounded-md transition-colors ${
        isOver ? "bg-accent/50 ring-1 ring-primary" : ""
      }`}
    >
      {children}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ConsultationGroupingSectionProps {
  roundId: string;
  roundLabel: string | null;
  initialGroups: ConsultationGroupDetail[];
  consultations: RoundConsultationSummary[];
  acceptedThemes: SourceTheme[];
}

export function ConsultationGroupingSection({
  roundId,
  roundLabel,
  initialGroups,
  consultations,
  acceptedThemes,
}: ConsultationGroupingSectionProps) {
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const {
    groups,
    ungrouped,
    selectedIds,
    toggleSelect,
    clearSelection,
    handleCreateGroup,
    handleRenameGroup,
    handleDeleteGroup,
    handleGroupSelected,
    handleDragEnd,
  } = useConsultationGrouping({ roundId, initialGroups, consultations });

  // dnd-kit sensors: pointer (mouse) + touch with 8px distance to avoid click conflicts
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 4 } })
  );

  const activeDragConsultation = activeDragId
    ? consultations.find((c) => c.id === activeDragId)
    : null;
  const activeDragCount =
    activeDragId && selectedIds.has(activeDragId) && selectedIds.size > 1
      ? selectedIds.size
      : 1;

  // Accept an AI suggestion: create group + assign its consultations
  const handleAcceptAiSuggestion = async (suggestion: SuggestedConsultationGroup) => {
    const groupId = await handleCreateGroup(suggestion.label);
    if (!groupId) return;
    // Assign each consultation to the new group
    for (let i = 0; i < suggestion.consultation_ids.length; i++) {
      await handleGroupSelected_single(suggestion.consultation_ids[i], groupId, i);
    }
  };

  // Helper: assign a single consultation to a group (without going through selectedIds)
  const handleGroupSelected_single = async (
    consultationId: string,
    groupId: string,
    position: number
  ) => {
    const { assignConsultationToGroup } = await import("@/lib/actions/consultation-groups");
    await assignConsultationToGroup(consultationId, roundId, groupId, position);
  };

  const hasSelection = selectedIds.size > 0;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleCreateGroup()}
          className="gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          Create Group
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setAiDialogOpen(true)}
          className="gap-1.5"
        >
          <Sparkles className="h-3.5 w-3.5" />
          AI Suggested Groups
        </Button>

        {hasSelection && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm" className="gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  Group Selected ({selectedIds.size})
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem
                  onClick={async () => {
                    const id = await handleCreateGroup();
                    if (!id) return;
                    await handleGroupSelected(id);
                  }}
                >
                  New group from selection
                </DropdownMenuItem>
                {groups.map((g) => (
                  <DropdownMenuItem key={g.id} onClick={() => handleGroupSelected(g.id)}>
                    Add to &ldquo;{g.label}&rdquo;
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="ghost" size="sm" onClick={clearSelection}>
              Clear selection
            </Button>
          </>
        )}
      </div>

      {/* DnD context wraps both ungrouped and groups */}
      <DndContext
        sensors={sensors}
        onDragStart={(e) => setActiveDragId(e.active.id as string)}
        onDragEnd={(e) => {
          setActiveDragId(null);
          handleDragEnd(e);
        }}
        onDragCancel={() => setActiveDragId(null)}
      >
        {/* Ungrouped consultations */}
        {ungrouped.length > 0 && (
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Ungrouped ({ungrouped.length})
              </CardTitle>
              <CardDescription className="text-xs">
                Drag consultations into a group, or select and use &ldquo;Group Selected&rdquo;
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <UngroupedDropZone>
                <SortableContext
                  items={ungrouped.map((c) => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {ungrouped.map((c) => (
                    <DraggableConsultationCard
                      key={c.id}
                      consultationId={c.id}
                      title={c.title}
                      status={c.status}
                      themeCount={c.themeCount}
                      isSelected={selectedIds.has(c.id)}
                      onToggleSelect={toggleSelect}
                    />
                  ))}
                </SortableContext>
              </UngroupedDropZone>
            </CardContent>
          </Card>
        )}

        {/* No consultations at all */}
        {consultations.length === 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Linked Consultations</CardTitle>
              <CardDescription>No consultations assigned to this round yet.</CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* All consultations grouped — show ungrouped drop zone placeholder */}
        {consultations.length > 0 && ungrouped.length === 0 && groups.length > 0 && (
          <UngroupedDropZone>
            <p className="text-xs text-muted-foreground text-center py-2">
              Drop here to ungroup
            </p>
          </UngroupedDropZone>
        )}

        {/* Groups */}
        <div className="space-y-3">
          {groups.map((group) => (
            <ConsultationGroupCard
              key={group.id}
              group={group}
              consultations={consultations}
              selectedIds={selectedIds}
              roundLabel={roundLabel}
              onToggleSelect={toggleSelect}
              onRename={handleRenameGroup}
              onDelete={handleDeleteGroup}
            />
          ))}
        </div>

        {/* Drag overlay */}
        <DragOverlay>
          {activeDragConsultation ? (
            <div className="rotate-1 space-y-2 opacity-80">
              <DraggableConsultationCard
                consultationId={activeDragConsultation.id}
                title={activeDragConsultation.title}
                status={activeDragConsultation.status}
                themeCount={activeDragConsultation.themeCount}
                isSelected={false}
                onToggleSelect={() => {}}
              />
              {activeDragCount > 1 ? (
                <div className="rounded-full border bg-background px-3 py-1 text-xs font-medium shadow-sm">
                  Moving {activeDragCount} consultations together
                </div>
              ) : null}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* AI suggestion dialog */}
      <AiGroupSuggestionDialog
        open={aiDialogOpen}
        onOpenChange={setAiDialogOpen}
        roundLabel={roundLabel}
        acceptedThemes={acceptedThemes}
        consultations={consultations}
        onAcceptSuggestion={handleAcceptAiSuggestion}
      />
    </div>
  );
}
