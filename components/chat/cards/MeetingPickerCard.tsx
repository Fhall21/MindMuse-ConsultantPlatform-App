"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useCardConfirm } from "@/components/chat/card-confirm-context";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CARD_DISMISSED_COPY,
  CARD_REOPEN_HELP,
} from "@/lib/chat/onboarding-copy";
import { readMeetingPickerOutput } from "@/lib/chat/tools/meetings-picker";
import { ChatToolCardShell } from "./chat-tool-card-shell";
import type { ChatCardProps } from "./types";

function formatMeetingDate(date: string | null): string {
  if (!date) {
    return "Date not set";
  }

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function MeetingPickerCard({
  tool,
  messageId,
  sessionId,
  onUpdated,
}: ChatCardProps) {
  const picker = useMemo(() => readMeetingPickerOutput(tool.output), [tool.output]);
  const { isPending, setPending } = useCardConfirm();
  const confirmKey = `select-meeting-themes:${messageId}`;
  const [selectedMeetingId, setSelectedMeetingId] = useState(picker?.meetings[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const status = tool.status ?? "pending";
  const toolResultId = tool.toolResultId;
  const pending = isPending(confirmKey);

  if (!picker) {
    return null;
  }

  if (status === "success") {
    return (
      <ChatToolCardShell
        success
        title="Meeting selected"
        description="Theme extraction is ready for review in the card below."
        successHelp={CARD_REOPEN_HELP}
      />
    );
  }

  if (status === "dismissed") {
    return (
      <ChatToolCardShell
        dismissed
        title="Meeting selection dismissed"
        description={CARD_DISMISSED_COPY}
      />
    );
  }

  async function handleExtract() {
    if (!selectedMeetingId) {
      setError("Choose a meeting to extract themes from.");
      return;
    }

    if (!sessionId) {
      setError("Chat session is unavailable. Refresh and try again.");
      return;
    }

    setPending(confirmKey, true);
    setError(null);

    try {
      const response = await fetch("/api/chat/themes/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          meetingId: selectedMeetingId,
          pickerToolResultId: toolResultId,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as
          | { detail?: string }
          | null;
        throw new Error(data?.detail ?? "Could not extract themes");
      }

      setPending(confirmKey, false);
      onUpdated?.();
    } catch (extractError) {
      setError(
        extractError instanceof Error
          ? extractError.message
          : "Could not extract themes"
      );
      setPending(confirmKey, false);
    }
  }

  async function handleDismiss() {
    if (!toolResultId || !sessionId) {
      return;
    }

    await fetch(`/api/chat/tool-results/${toolResultId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, status: "dismissed" }),
    });
    onUpdated?.();
  }

  return (
    <ChatToolCardShell
      title="Which meeting should we extract themes from?"
      description="Choose a saved meeting from this consultation."
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`meeting-picker-${messageId}`}>Meeting</Label>
          <Select value={selectedMeetingId} onValueChange={setSelectedMeetingId}>
            <SelectTrigger id={`meeting-picker-${messageId}`}>
              <SelectValue placeholder="Select a meeting" />
            </SelectTrigger>
            <SelectContent>
              {picker.meetings.map((meeting) => (
                <SelectItem key={meeting.id} value={meeting.id}>
                  {meeting.title} · {formatMeetingDate(meeting.date)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={pending} onClick={() => void handleExtract()}>
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Extracting themes…
              </>
            ) : (
              "Extract themes"
            )}
          </Button>
          <Button type="button" variant="ghost" disabled={pending} onClick={() => void handleDismiss()}>
            Dismiss
          </Button>
        </div>
      </div>
    </ChatToolCardShell>
  );
}
