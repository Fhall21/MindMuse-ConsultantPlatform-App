"use client";

import { useEffect, useId, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SaveState = "idle" | "saving" | "saved" | "error";

type IntervalValue = "5" | "10" | "15" | "20" | "disabled";

function toSelectValue(interval: number | null): IntervalValue {
  if (interval === null) return "disabled";
  return String(interval) as IntervalValue;
}

export function NotificationPreferences() {
  const selectId = useId();
  const [value, setValue] = useState<IntervalValue | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  useEffect(() => {
    fetch("/api/settings/notification-auto-trigger", { credentials: "include" })
      .then((r) => r.json())
      .then((data: { interval: number | null }) => {
        setValue(toSelectValue(data.interval));
      })
      .catch(() => {
        setValue("disabled");
      });
  }, []);

  async function handleChange(next: IntervalValue) {
    setValue(next);
    setSaveState("saving");
    try {
      const res = await fetch("/api/settings/notification-auto-trigger", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval: next }),
      });
      if (!res.ok) throw new Error("save failed");
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 4000);
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">Cross-meeting analysis</h3>
      <p className="text-sm text-muted-foreground">
        MindMuse can automatically analyse patterns across meetings in a consultation. Choose how
        often to run this, or turn it off.
      </p>
      <div className="flex items-center gap-3">
        <label htmlFor={selectId} className="text-sm font-medium text-foreground">
          Run automatically every
        </label>
        <Select value={value ?? undefined} onValueChange={handleChange} disabled={value === null}>
          <SelectTrigger id={selectId} className="w-48">
            <SelectValue placeholder="Loading…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="5">Every 5 meetings</SelectItem>
            <SelectItem value="10">Every 10 meetings</SelectItem>
            <SelectItem value="15">Every 15 meetings</SelectItem>
            <SelectItem value="20">Every 20 meetings</SelectItem>
            <SelectItem value="disabled">Disabled</SelectItem>
          </SelectContent>
        </Select>
        {saveState === "saved" && (
          <span className="text-xs text-muted-foreground">Saved ✓</span>
        )}
        {saveState === "error" && (
          <span className="text-xs text-destructive">Couldn&apos;t save</span>
        )}
      </div>
    </div>
  );
}
