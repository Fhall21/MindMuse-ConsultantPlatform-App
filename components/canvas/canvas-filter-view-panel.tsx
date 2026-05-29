"use client";

import type { Dispatch, SetStateAction } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CanvasFilterState, CanvasNodeType } from "@/types/canvas";

type CanvasFilterPreset = "all" | "accepted" | "themes" | "insights";

const FILTER_PRESETS: Record<
  CanvasFilterPreset,
  {
    label: string;
    description: string;
    nodeTypes: CanvasNodeType[];
    acceptedOnly: boolean;
  }
> = {
  all: {
    label: "All nodes",
    description: "Show themes and insights together.",
    nodeTypes: ["theme", "insight"],
    acceptedOnly: false,
  },
  accepted: {
    label: "Accepted only",
    description: "Show accepted themes and insights only.",
    nodeTypes: ["theme", "insight"],
    acceptedOnly: true,
  },
  themes: {
    label: "Themes only",
    description: "Show group themes and hide insight cards.",
    nodeTypes: ["theme"],
    acceptedOnly: false,
  },
  insights: {
    label: "Insights only",
    description: "Show insight cards without the group headers.",
    nodeTypes: ["insight"],
    acceptedOnly: false,
  },
};

function resolveFilterPreset(filters: CanvasFilterState): CanvasFilterPreset {
  if (filters.acceptedOnly) {
    return "accepted";
  }

  const hasTheme = filters.nodeTypes.includes("theme");
  const hasInsight = filters.nodeTypes.includes("insight");

  if (hasTheme && hasInsight) {
    return "all";
  }

  if (hasTheme) {
    return "themes";
  }

  if (hasInsight) {
    return "insights";
  }

  return "all";
}

function applyFilterPreset(current: CanvasFilterState, preset: CanvasFilterPreset): CanvasFilterState {
  const next = FILTER_PRESETS[preset];

  return {
    ...current,
    nodeTypes: [...next.nodeTypes],
    acceptedOnly: next.acceptedOnly,
  };
}

interface CanvasFilterViewPanelProps {
  filters: CanvasFilterState;
  onChangeFilters: Dispatch<SetStateAction<CanvasFilterState>>;
  onClose: () => void;
}

export function CanvasFilterViewPanel({
  filters,
  onChangeFilters,
  onClose,
}: CanvasFilterViewPanelProps) {
  const preset = resolveFilterPreset(filters);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">Filter view</p>
          <p className="text-xs text-muted-foreground">
            Pick a preset for what stays on the canvas.
          </p>
        </div>

        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-4 w-4" />
          <span className="sr-only">Close filter view</span>
        </Button>
      </div>

      <div className="space-y-4 px-4 py-3">
        <div className="space-y-2">
          <label
            htmlFor="canvas-filter-view"
            className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground"
          >
            View preset
          </label>
          <Select
            value={preset}
            onValueChange={(value) =>
              onChangeFilters((current) => applyFilterPreset(current, value as CanvasFilterPreset))
            }
          >
            <SelectTrigger id="canvas-filter-view" className="h-9">
              <SelectValue placeholder="Choose a view" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(FILTER_PRESETS).map(([value, presetItem]) => (
                <SelectItem key={value} value={value}>
                  {presetItem.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg border bg-muted/20 px-3 py-2">
          <p className="text-xs font-medium text-foreground">{FILTER_PRESETS[preset].label}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {FILTER_PRESETS[preset].description}
          </p>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          More filters can live here later without changing the toolbar again.
        </p>
      </div>
    </div>
  );
}
