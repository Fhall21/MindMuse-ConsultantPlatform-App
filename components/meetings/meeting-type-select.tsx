"use client";

import { ChevronDown } from "lucide-react";
import { Label } from "@/components/ui/label";
import { useMeetingTypes } from "@/hooks/use-meeting-types";

interface MeetingTypeSelectProps {
  id?: string;
  value: string;
  onChange: (meetingTypeId: string) => void;
  disabled?: boolean;
}

export function MeetingTypeSelect({
  id = "meetingType",
  value,
  onChange,
  disabled = false,
}: MeetingTypeSelectProps) {
  const { data: meetingTypes = [], isLoading } = useMeetingTypes();

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Meeting type</Label>
      <div className="relative">
        <select
          id={id}
          value={value}
          disabled={disabled || isLoading}
          onChange={(event) => onChange(event.target.value)}
          className="flex h-9 w-full appearance-none rounded-md border border-input bg-transparent px-3 py-1 pr-8 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">Select type…</option>
          {meetingTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.label} ({type.code})
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>
    </div>
  );
}
