"use client";

import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

interface DraggableConsultationCardProps {
  consultationId: string;
  title: string;
  status: string;
  themeCount?: number;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
}

function statusBadgeVariant(status: string) {
  if (status === "complete") return "default" as const;
  return "secondary" as const;
}

export function DraggableConsultationCard({
  consultationId,
  title,
  status,
  themeCount,
  isSelected,
  onToggleSelect,
}: DraggableConsultationCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: consultationId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-md border px-3 py-2.5 bg-background"
    >
      {/* Drag handle */}
      <button
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground shrink-0"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        tabIndex={-1}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Checkbox for multi-select */}
      <Checkbox
        checked={isSelected}
        onCheckedChange={() => onToggleSelect(consultationId)}
        aria-label={`Select ${title}`}
        className="shrink-0"
      />

      {/* Consultation info */}
      <Link
        href={`/consultations/${consultationId}`}
        className="min-w-0 flex-1 space-y-0.5 hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-medium truncate">{title}</p>
        {themeCount !== undefined && (
          <p className="text-xs text-muted-foreground">
            {themeCount} theme{themeCount !== 1 ? "s" : ""}
          </p>
        )}
      </Link>

      <Badge variant={statusBadgeVariant(status)} className="ml-2 shrink-0">
        {status}
      </Badge>
    </div>
  );
}
