"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PredefinedSection } from "@/lib/report-sections-registry";

interface BuilderAvailableSectionProps {
  section: PredefinedSection;
  disabled: boolean;
  onAdd: () => void;
}

export function BuilderAvailableSection({
  section,
  disabled,
  onAdd,
}: BuilderAvailableSectionProps) {
  return (
    <div className="flex items-start gap-2 rounded-md border px-3 py-2">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{section.heading}</p>
        <p className="text-xs text-muted-foreground line-clamp-2">
          {section.description}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon-xs"
        disabled={disabled}
        onClick={onAdd}
      >
        <Plus className="size-3.5" />
      </Button>
    </div>
  );
}
