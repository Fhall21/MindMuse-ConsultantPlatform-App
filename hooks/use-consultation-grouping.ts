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
  meetingId: string;
  meetingTitle: string;
  meetingStatus: string;
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
  meetings: RoundConsultationSummary[];
}

export function useConsultationGrouping({
  roundId,
  initialGroups,
  meetings,
}: UseConsultationGroupingProps) {
  const [groups, setGroups] = useState<LocalGroup[]>(() =>
    initialGroups.map((g) => ({
      id: g.id,
      label: g.label,
      position: g.position,
      members: g.members.map((m) => ({
        id: m.id,
        meetingId: m.consultationId,
        meetingTitle: m.consultationTitle,
        meetingStatus: m.consultationStatus,
        position: m.position,
      })),
    }))
  );

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // In-flight guard: meeting IDs currently being persisted
  const inFlightIds = useRef<Set<string>>(new Set());

  // ─── Derived: which meetings are ungrouped ──────────────────────────────────

  const groupedMeetingIds = new Set(
    groups.flatMap((g) => g.members.map((m) => m.meetingId))
  );

  const ungrouped = meetings.filter((meeting) => !groupedMeetingIds.has(meeting.id));

  // ─── Selection ──────────────────────────────────────────────────────────────

  const toggleSelect = useCallback((meetingId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(meetingId)) next.delete(meetingId);
      else next.add(meetingId);
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

  const handleAssignConsultationsToGroup = useCallback(
    async (meetingIds: string[], targetGroupId: string, startPosition = 0) => {
      const ids = [...new Set(meetingIds.filter(Boolean))];
      if (ids.length === 0) return;

      if (ids.some((id) => inFlightIds.current.has(id))) return;
      ids.forEach((id) => inFlightIds.current.add(id));

      setGroups((prev) => {
        const meetingMap = new Map(meetings.map((meeting) => [meeting.id, meeting]));
        return prev.map((g) => {
          if (g.id !== targetGroupId) {
            return {
              ...g,
              members: g.members.filter(
                (m) => !ids.includes(m.meetingId)
              ),
            };
          }

          const retainedMembers = g.members.filter(
            (m) => !ids.includes(m.meetingId)
          );
          const existingIds = new Set(retainedMembers.map((m) => m.meetingId));
          const toAdd = ids
            .filter((id) => !existingIds.has(id))
            .map((id, index): LocalGroupMember => {
              const meeting = meetingMap.get(id);
              return {
                id: `optimistic-${targetGroupId}-${id}`,
                meetingId: id,
                meetingTitle: meeting?.title ?? "",
                meetingStatus: meeting?.status ?? "draft",
                position: startPosition + index,
              };
            });

          return {
            ...g,
            members: [...retainedMembers, ...toAdd],
          };
        });
      });

      try {
        await Promise.all(
          ids.map((id, index) =>
            assignConsultationToGroup(id, roundId, targetGroupId, startPosition + index)
          )
        );
      } catch {
        toast.error("Failed to assign consultations to group");
      } finally {
        ids.forEach((id) => inFlightIds.current.delete(id));
      }
    },
    [meetings, roundId]
  );

  // ─── Group selected meetings ────────────────────────────────────────────────

  const handleGroupSelected = useCallback(
    async (targetGroupId: string) => {
      const ids = Array.from(selectedIds);
      if (ids.length === 0) return;

      clearSelection();

      await handleAssignConsultationsToGroup(ids, targetGroupId, 0);
    },
    [selectedIds, clearSelection, handleAssignConsultationsToGroup]
  );

  // ─── Drag and drop ──────────────────────────────────────────────────────────

  /**
   * Container ID encoding:
   *   - Ungrouped area: "ungrouped"
   *   - Group: group.id
   *
   * Draggable ID: meeting.id
   */
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) return;

      const meetingId = active.id as string;
      if (inFlightIds.current.has(meetingId)) return;
      const draggedIds =
        selectedIds.has(meetingId) && selectedIds.size > 1
          ? Array.from(selectedIds)
          : [meetingId];

      // Determine source container
      const sourceGroup = groups.find((g) =>
        g.members.some((m) => m.meetingId === meetingId)
      );
      const sourceContainerId = sourceGroup?.id ?? "ungrouped";

      // Determine target container:
      // over.id can be a consultation ID (dropped onto a sibling) or a container ID
      let targetContainerId: string;
      const overIsGroup = groups.some((g) => g.id === over.id);
      if (over.id === "ungrouped" || overIsGroup) {
        targetContainerId = over.id as string;
      } else {
        // over.id is a meeting ID — find which container owns it
        const owningGroup = groups.find((g) =>
          g.members.some((m) => m.meetingId === over.id)
        );
        targetContainerId = owningGroup?.id ?? "ungrouped";
      }

      if (sourceContainerId === targetContainerId) {
        // Reorder within the same container
        if (targetContainerId === "ungrouped") return; // ungrouped has no server-side order
        const group = groups.find((g) => g.id === targetContainerId);
        if (!group) return;

        const oldIndex = group.members.findIndex((m) => m.meetingId === meetingId);
        const newIndex = group.members.findIndex((m) => m.meetingId === over.id);
        if (oldIndex === newIndex || oldIndex === -1 || newIndex === -1) return;

        const reordered = arrayMove(group.members, oldIndex, newIndex).map((m, i) => ({
          ...m,
          position: i,
        }));

        // Optimistic
        setGroups((prev) =>
          prev.map((g) => (g.id === targetContainerId ? { ...g, members: reordered } : g))
        );

        inFlightIds.current.add(meetingId);
        try {
          await reorderGroupMembers(
            targetContainerId,
            roundId,
            reordered.map((m) => m.meetingId)
          );
        } catch {
          toast.error("Failed to save order");
        } finally {
          inFlightIds.current.delete(meetingId);
        }
        return;
      }

      // Cross-container move
      const targetGroupId = targetContainerId === "ungrouped" ? null : targetContainerId;
      const targetGroup = targetGroupId ? groups.find((g) => g.id === targetGroupId) : null;
      const newPosition = targetGroup ? targetGroup.members.length : 0;

      const draggedMeetings = draggedIds
        .map((id) => meetings.find((meeting) => meeting.id === id))
        .filter((meeting): meeting is RoundConsultationSummary => Boolean(meeting));
      if (draggedMeetings.length === 0) return;

      // Optimistic
      setGroups((prev) =>
        prev.map((g) => {
          // Remove from source
          if (g.id === sourceContainerId || draggedIds.some((id) => g.members.some((m) => m.meetingId === id))) {
            return {
              ...g,
              members: g.members.filter((member) => !draggedIds.includes(member.meetingId)),
            };
          }
          // Add to target
          if (targetGroupId && g.id === targetGroupId) {
            return {
              ...g,
                members: [
                  ...g.members,
                  ...draggedMeetings.map((meeting, index) => ({
                    id: `optimistic-${meeting.id}`,
                    meetingId: meeting.id,
                    meetingTitle: meeting.title,
                    meetingStatus: meeting.status,
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
        toast.error("Failed to move meeting");
        // Revert optimistic update on error
        setGroups((prev) =>
          prev.map((g) => {
            if (g.id === targetGroupId) {
              return {
                ...g,
                members: g.members.filter((member) => !draggedIds.includes(member.meetingId)),
              };
            }
            if (g.id === sourceContainerId || draggedIds.some((id) => g.members.some((m) => m.meetingId === id))) {
              return {
                ...g,
                members: [
                  ...g.members,
                  ...draggedMeetings.map((meeting, index) => ({
                    id: `optimistic-${meeting.id}`,
                    meetingId: meeting.id,
                    meetingTitle: meeting.title,
                    meetingStatus: meeting.status,
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
    [clearSelection, meetings, groups, roundId, selectedIds]
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
    handleAssignConsultationsToGroup,
    handleGroupSelected,
    handleDragEnd,
  };
}
