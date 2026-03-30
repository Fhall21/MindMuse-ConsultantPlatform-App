"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ChevronDown, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { BuilderSectionConfig } from "@/types/db";
import { getPredefinedSection } from "@/lib/report-sections-registry";

interface BuilderSectionRowProps {
  config: BuilderSectionConfig;
  customHeading?: string;
  onDepthChange: (depth: "brief" | "detailed") => void;
  onPurposeChange: (purpose: string | null) => void;
  onProseGuidanceChange: (proseGuidance: string | null) => void;
  onNoteChange: (note: string | null) => void;
  onRemove: () => void;
}

const MAX_NOTE_LENGTH = 500;
const MAX_TEXT_LENGTH = 500;

export function BuilderSectionRow({
  config,
  customHeading,
  onDepthChange,
  onPurposeChange,
  onProseGuidanceChange,
  onNoteChange,
  onRemove,
}: BuilderSectionRowProps) {
  const [expanded, setExpanded] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: config.sectionId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const predefined = getPredefinedSection(config.sectionId);
  const heading = predefined?.heading ?? customHeading ?? "Untitled Section";

  const noteLength = config.note?.length ?? 0;
  const purposeLength = config.purpose?.length ?? 0;
  const proseGuidanceLength = config.proseGuidance?.length ?? 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-md border bg-card",
        isDragging && "opacity-50 shadow-lg"
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>

        <span className="flex-1 text-sm font-medium truncate">{heading}</span>

        <div className="flex items-center gap-1">
          <button
            type="button"
            className={cn(
              "rounded-l-md border px-2 py-0.5 text-xs transition-colors",
              config.depth === "brief"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:bg-muted"
            )}
            onClick={() => onDepthChange("brief")}
          >
            Brief
          </button>
          <button
            type="button"
            className={cn(
              "rounded-r-md border border-l-0 px-2 py-0.5 text-xs transition-colors",
              config.depth === "detailed"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:bg-muted"
            )}
            onClick={() => onDepthChange("detailed")}
          >
            Detailed
          </button>
        </div>

        {config.note && (
          <Badge variant="secondary" className="text-[10px]">
            note
          </Badge>
        )}

        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setExpanded(!expanded)}
        >
          <ChevronDown
            className={cn(
              "size-3.5 transition-transform",
              expanded && "rotate-180"
            )}
          />
        </Button>
      </div>

      {expanded && (
        <div className="border-t px-3 py-2 space-y-2">
          {predefined && (
            <p className="text-xs text-muted-foreground">
              {predefined.description}
            </p>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Description
            </label>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              One short sentence on the section&apos;s job or outcome.
            </p>
            <Textarea
              value={config.purpose ?? ""}
              onChange={(e) => {
                const value = e.target.value;
                onPurposeChange(value || null);
              }}
              maxLength={MAX_TEXT_LENGTH}
              placeholder="Explain what this section should cover."
              className="mt-1 min-h-[4rem] text-sm"
            />
            <span className="text-[10px] text-muted-foreground">
              {purposeLength}/{MAX_TEXT_LENGTH}
            </span>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Elaboration
            </label>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Add writing guidance: voice, intent, examples to include, what to avoid,
              and how long or detailed the section should be.
            </p>
            <Textarea
              value={config.proseGuidance ?? ""}
              onChange={(e) => {
                const value = e.target.value;
                onProseGuidanceChange(value || null);
              }}
              maxLength={MAX_TEXT_LENGTH}
              placeholder="Add extra guidance about how this section should be written."
              className="mt-1 min-h-[4rem] text-sm"
            />
            <span className="text-[10px] text-muted-foreground">
              {proseGuidanceLength}/{MAX_TEXT_LENGTH}
            </span>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Section note (optional)
            </label>
            <Textarea
              value={config.note ?? ""}
              onChange={(e) => {
                const value = e.target.value;
                onNoteChange(value || null);
              }}
              maxLength={MAX_NOTE_LENGTH}
              placeholder="e.g. Focus on risk factors and mitigation strategies..."
              className="mt-1 min-h-[4rem] text-sm"
            />
            <span className="text-[10px] text-muted-foreground">
              {noteLength}/{MAX_NOTE_LENGTH}
            </span>
          </div>

          <Button
            variant="destructive"
            size="xs"
            onClick={onRemove}
          >
            <Trash2 className="size-3" />
            Remove
          </Button>
        </div>
      )}
    </div>
  );
}
