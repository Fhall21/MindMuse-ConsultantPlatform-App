"use client";

import { useState } from "react";
import { ArrowRight, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { ConnectionType } from "@/types/canvas";

export const CONNECTION_TYPE_LABELS: Record<ConnectionType, string> = {
  causes: "Causes",
  influences: "Influences",
  supports: "Supports",
  contradicts: "Contradicts",
  related_to: "Related to",
};

const CONNECTION_TYPE_OPTIONS = Object.entries(CONNECTION_TYPE_LABELS) as Array<
  [ConnectionType, string]
>;

interface ConnectionTypePromptProps {
  sourceLabel: string;
  targetLabel: string;
  initialType?: ConnectionType;
  initialNote?: string;
  onSave: (payload: { type: ConnectionType; note: string }) => void;
  onDismiss: () => void;
}

export function ConnectionTypePrompt({
  sourceLabel,
  targetLabel,
  initialType = "related_to",
  initialNote = "",
  onSave,
  onDismiss,
}: ConnectionTypePromptProps) {
  const [selectedType, setSelectedType] = useState<ConnectionType>(initialType);
  const [note, setNote] = useState(initialNote);

  return (
    <div className="absolute bottom-4 left-4 z-20 w-[320px] rounded-2xl border bg-background/98 p-4 shadow-xl">
      <div className="mb-3 flex items-center gap-2">
        <div className="rounded-full border p-2 text-muted-foreground">
          <Link2 className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold">Set connection type</p>
          <p className="text-xs text-muted-foreground">
            Keep the edge, then choose the clearest relationship.
          </p>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs">
        <Badge variant="outline" className="max-w-[120px] truncate">
          {sourceLabel}
        </Badge>
        <ArrowRight className="h-3 w-3 text-muted-foreground" />
        <Badge variant="outline" className="max-w-[120px] truncate">
          {targetLabel}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {CONNECTION_TYPE_OPTIONS.map(([type, label]) => (
          <Button
            key={type}
            type="button"
            variant={selectedType === type ? "secondary" : "outline"}
            className="justify-start"
            onClick={() => setSelectedType(type)}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="mt-3 space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Optional note
        </label>
        <Input
          value={note}
          onChange={(event) => setNote(event.target.value.slice(0, 500))}
          placeholder="Why does this relationship matter?"
        />
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
          Keep default
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => onSave({ type: selectedType, note })}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
