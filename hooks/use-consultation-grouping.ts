"use client";

import { useState, useCallback, useRef } from "react";
import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { toast } from "sonner";
import {
  createConsultationGroup,
  updateConsultationGroup,
  deleteConsultationGroup,
  assignConsultationToGroup,
  reorderGroupMembers,
} from "@/lib/actions/consultation-groups";
import type { ConsultationGroupDetail, RoundConsultationSummary } from "@/types/round-detail";

// ─── Local state shapes ───────────────────────────────────────────────────────

export interface LocalGroupMember {
  id: string;
  consultationId: string;
  consultationTitle: string;
  consultationStatus: string;
  position: number;
}

export interface LocalGroup {
  id: string;
  label: string;
  position: number;
  members: LocalGroupMember[];
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseConsultationGroupingProps {
  roundId: string;
  initialGroups: ConsultationGroupDetail[];
  consultations: RoundConsultationSummary[];
}

export function useConsultationGrouping({
  roundId,
  initialGroups,
  consultations,
}: UseConsultationGroupingProps) {
  const [groups, setGroups] = useState<LocalGroup[]>(() =>
    initialGroups.map((g) => ({
      id: g.id,
      label: g.label,
      position: g.position,
      members: g.members.map((m) => ({
        id: m.id,
        consultationId: m.consultationId,
        consultationTitle: m.consultationTitle,
        consultationStatus: m.consultationStatus,
        position: m.position,
      })),
    }))
  );

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // In-flight guard: consultation IDs currently being persisted
  const inFlightIds = useRef<Set<string>>(new Set());

  // ─── Derived: which consultations are ungrouped ─────────────────────────────

  const groupedConsultationIds = new Set(
    groups.flatMap((g) => g.members.map((m) => m.consultationId))
  );

  const ungrouped = consultations.filter((c) => !groupedConsultationIds.has(c.id));

  // ─── Selection ──────────────────────────────────────────────────────────────

  const toggleSelect = useCallback((consultationId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(consultationId)) next.delete(consultationId);
      else next.add(consultationId);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // ─── CRUD ───────────────────────────────────────────────────────────────────

  const handleCreateGroup = useCallback(
    async (label?: string) => {
      try {
        const created = await createConsultationGroup(roundId, label);
        setGroups((prev) => [
          ...prev,
          { id: created.id, label: created.label, position: created.position, members: [] },
        ]);
        return created.id;
      } catch {
        toast.error("Failed to create group");
        return null;
      }
    },
    [roundId]
  );

  const handleRenameGroup = useCallback(async (groupId: string, label: string) => {
    // Optimistic
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, label } : g))
    );
    try {
      await updateConsultationGroup(groupId, label);
    } catch {
      toast.error("Failed to rename group");
      // Revert not trivial without snapshot — rely on page refresh or re-fetch
    }
  }, []);

  const handleDeleteGroup = useCallback(async (groupId: string) => {
    // Optimistic
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    try {
      await deleteConsultationGroup(groupId);
    } catch {
      toast.error("Failed to delete group");
    }
  }, []);

  // ─── Group selected consultations ───────────────────────────────────────────

  const handleGroupSelected = useCallback(
    async (targetGroupId: string) => {
      const ids = Array.from(selectedIds);
      if (ids.length === 0) return;

      // Guard in-flight
      if (ids.some((id) => inFlightIds.current.has(id))) return;
      ids.forEach((id) => inFlightIds.current.add(id));

      // Optimistic: move each selected consultation to the target group
      setGroups((prev) => {
        const consultationMap = new Map(consultations.map((c) => [c.id, c]));
        return prev.map((g) => {
          if (g.id !== targetGroupId) {
            // Remove these consultations from any other group
            return { ...g, members: g.members.filter((m) => !selectedIds.has(m.consultationId)) };
          }
          const existingIds = new Set(g.members.map((m) => m.consultationId));
          const toAdd = ids
            .filter((id) => !existingIds.has(id))
            .map((id, i): LocalGroupMember => {
              const c = consultationMap.get(id);
              return {
                id: `optimistic-${id}`,
                consultationId: id,
                consultationTitle: c?.title ?? "",
                consultationStatus: c?.status ?? "draft",
                position: g.members.length + i,
              };
            });
          return { ...g, members: [...g.members, ...toAdd] };
        });
      });

      clearSelection();

      try {
        await Promise.all(
          ids.map((id, i) =>
            assignConsultationToGroup(id, roundId, targetGroupId, i)
          )
        );
      } catch {
        toast.error("Failed to assign consultations to group");
      } finally {
        ids.forEach((id) => inFlightIds.current.delete(id));
      }
    },
    [selectedIds, consultations, roundId, clearSelection]
  );

  // ─── Drag and drop ──────────────────────────────────────────────────────────

  /**
   * Container ID encoding:
   *   - Ungrouped area: "ungrouped"
   *   - Group: group.id
   *
   * Draggable ID: consultation.id
   */
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) return;

      const consultationId = active.id as string;
      if (inFlightIds.current.has(consultationId)) return;
      const draggedIds =
        selectedIds.has(consultationId) && selectedIds.size > 1
          ? Array.from(selectedIds)
          : [consultationId];

      // Determine source container
      const sourceGroup = groups.find((g) =>
        g.members.some((m) => m.consultationId === consultationId)
      );
      const sourceContainerId = sourceGroup?.id ?? "ungrouped";

      // Determine target container:
      // over.id can be a consultation ID (dropped onto a sibling) or a container ID
      let targetContainerId: string;
      const overIsGroup = groups.some((g) => g.id === over.id);
      if (over.id === "ungrouped" || overIsGroup) {
        targetContainerId = over.id as string;
      } else {
        // over.id is a consultation ID — find which container owns it
        const owningGroup = groups.find((g) =>
          g.members.some((m) => m.consultationId === over.id)
        );
        targetContainerId = owningGroup?.id ?? "ungrouped";
      }

      if (sourceContainerId === targetContainerId) {
        // Reorder within the same container
        if (targetContainerId === "ungrouped") return; // ungrouped has no server-side order
        const group = groups.find((g) => g.id === targetContainerId);
        if (!group) return;

        const oldIndex = group.members.findIndex((m) => m.consultationId === consultationId);
        const newIndex = group.members.findIndex((m) => m.consultationId === over.id);
        if (oldIndex === newIndex || oldIndex === -1 || newIndex === -1) return;

        const reordered = arrayMove(group.members, oldIndex, newIndex).map((m, i) => ({
          ...m,
          position: i,
        }));

        // Optimistic
        setGroups((prev) =>
          prev.map((g) => (g.id === targetContainerId ? { ...g, members: reordered } : g))
        );

        inFlightIds.current.add(consultationId);
        try {
          await reorderGroupMembers(
            targetContainerId,
            roundId,
            reordered.map((m) => m.consultationId)
          );
        } catch {
          toast.error("Failed to save order");
        } finally {
          inFlightIds.current.delete(consultationId);
        }
        return;
      }

      // Cross-container move
      const targetGroupId = targetContainerId === "ungrouped" ? null : targetContainerId;
      const targetGroup = targetGroupId ? groups.find((g) => g.id === targetGroupId) : null;
      const newPosition = targetGroup ? targetGroup.members.length : 0;

      const draggedConsultations = draggedIds
        .map((id) => consultations.find((consultation) => consultation.id === id))
        .filter((consultation): consultation is RoundConsultationSummary => Boolean(consultation));
      if (draggedConsultations.length === 0) return;

      // Optimistic
      setGroups((prev) =>
        prev.map((g) => {
          // Remove from source
          if (g.id === sourceContainerId || draggedIds.some((id) => g.members.some((m) => m.consultationId === id))) {
            return {
              ...g,
              members: g.members.filter((member) => !draggedIds.includes(member.consultationId)),
            };
          }
          // Add to target
          if (targetGroupId && g.id === targetGroupId) {
            return {
              ...g,
                members: [
                  ...g.members,
                  ...draggedConsultations.map((consultation, index) => ({
                    id: `optimistic-${consultation.id}`,
                    consultationId: consultation.id,
                    consultationTitle: consultation.title,
                    consultationStatus: consultation.status,
                    position: newPosition + index,
                  })),
                ],
            };
          }
          return g;
        })
      );

      draggedIds.forEach((id) => inFlightIds.current.add(id));
      try {
        await Promise.all(
          draggedIds.map((id, index) =>
            assignConsultationToGroup(id, roundId, targetGroupId, newPosition + index)
          )
        );
        clearSelection();
      } catch {
        toast.error("Failed to move consultation");
        // Revert optimistic update on error
        setGroups((prev) =>
          prev.map((g) => {
            if (g.id === targetGroupId) {
              return {
                ...g,
                members: g.members.filter((member) => !draggedIds.includes(member.consultationId)),
              };
            }
            if (g.id === sourceContainerId || draggedIds.some((id) => g.members.some((m) => m.consultationId === id))) {
              return {
                ...g,
                members: [
                  ...g.members,
                  ...draggedConsultations.map((consultation, index) => ({
                    id: `optimistic-${consultation.id}`,
                    consultationId: consultation.id,
                    consultationTitle: consultation.title,
                    consultationStatus: consultation.status,
                    position: g.members.length + index,
                  })),
                ],
              };
            }
            return g;
          })
        );
      } finally {
        draggedIds.forEach((id) => inFlightIds.current.delete(id));
      }
    },
    [clearSelection, consultations, groups, roundId, selectedIds]
  );

  return {
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
  };
}
