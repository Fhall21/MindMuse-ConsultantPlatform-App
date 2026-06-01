"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCardConfirm } from "@/components/chat/card-confirm-context";
import { readMeetingPickerOutput } from "@/lib/chat/tools/meetings-picker";
import { ChatToolCardShell } from "./chat-tool-card-shell";
import type { ChatCardProps } from "./types";

function formatMeetingDate(date: string | null): string {
  if (!date) return "";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function MeetingActionPickerCard({
  tool,
  messageId,
  sessionId,
  onUpdated,
}: ChatCardProps) {
  const picker = useMemo(() => readMeetingPickerOutput(tool.output), [tool.output]);
  const { isPending, setPending } = useCardConfirm();
  const confirmKey = `meeting-action:${messageId}`;
  const pending = isPending(confirmKey);

  const toolResultId =
    tool.output && typeof tool.output === "object"
      ? ((tool.output as Record<string, unknown>).tool_result_id as string | undefined)
      : undefined;

  const [selectedMeetingId, setSelectedMeetingId] = useState(picker?.meetings[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const status = tool.status ?? "pending";

  if (status === "success") {
    return (
      <ChatToolCardShell
        success
        title="Meeting selected"
        description="Continue in the chat to proceed."
      />
    );
  }

  if (!picker) return null;

  async function handleConfirm() {
    if (!selectedMeetingId || !sessionId || !toolResultId) return;
    setPending(confirmKey, true);
    setError(null);

    try {
      const response = await fetch(`/api/chat/tool-results/${toolResultId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          meeting_id: selectedMeetingId,
          status: "success",
        }),
      });

      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error((json as { detail?: string }).detail ?? "Could not confirm selection");
      }

      onUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm selection");
    } finally {
      setPending(confirmKey, false);
    }
  }

  return (
    <ChatToolCardShell
      title="Which meeting?"
      description="Choose a meeting to continue."
      error={error}
      footer={
        <Button
          type="button"
          size="sm"
          disabled={pending || !selectedMeetingId}
          onClick={() => void handleConfirm()}
        >
          {pending ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
          Confirm
        </Button>
      }
    >
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Meeting</Label>
        <Select value={selectedMeetingId} onValueChange={setSelectedMeetingId}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Select a meeting" />
          </SelectTrigger>
          <SelectContent>
            {picker.meetings.map((meeting) => (
              <SelectItem key={meeting.id} value={meeting.id}>
                {meeting.title}
                {meeting.date ? ` · ${formatMeetingDate(meeting.date)}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </ChatToolCardShell>
  );
}
