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
import {
  CARD_DISMISSED_COPY,
} from "@/lib/chat/onboarding-copy";
import { meetingPickerSuccessDescription } from "@/lib/chat/meeting-picker-card-copy";
import { readMeetingPendingAction } from "@/lib/chat/meeting-pending-action";
import { readMeetingPickerOutput } from "@/lib/chat/tools/meetings-picker";
import { ChatToolCardShell } from "./chat-tool-card-shell";
import {
  confirmMeetingPickerSelection,
  useMeetingPickerConfirmLock,
} from "./use-meeting-picker-confirm";
import { readToolResultId, type ChatCardProps } from "./types";

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
  onSubmitText,
}: ChatCardProps) {
  const picker = useMemo(() => readMeetingPickerOutput(tool.output), [tool.output]);
  const pendingAction = useMemo(
    () =>
      readMeetingPendingAction({
        output: tool.output,
        input: tool.input,
        pickerToolName: "select_meeting_for_action",
      }),
    [tool.output, tool.input]
  );
  const { isPending, setPending } = useCardConfirm();
  const confirmKey = `meeting-action:${messageId}`;
  const pending = isPending(confirmKey);
  const { hasContinued, markContinued } = useMeetingPickerConfirmLock();

  const toolResultId = readToolResultId(tool);

  const [selectedMeetingId, setSelectedMeetingId] = useState(picker?.meetings[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const status = tool.status ?? "pending";

  const outputRecord =
    tool.output && typeof tool.output === "object"
      ? (tool.output as Record<string, unknown>)
      : null;
  const outputMeetingId =
    typeof outputRecord?.meeting_id === "string" ? outputRecord.meeting_id : null;

  if (status === "dismissed") {
    return (
      <ChatToolCardShell
        dismissed
        title="Meeting selection dismissed"
        description={CARD_DISMISSED_COPY}
      />
    );
  }

  if (status === "success" || outputMeetingId) {
    return (
      <ChatToolCardShell
        success
        title="Meeting selected"
        description={meetingPickerSuccessDescription(pendingAction)}
      />
    );
  }

  if (!picker) return null;

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

  async function handleConfirm() {
    if (hasContinued()) {
      return;
    }

    if (!selectedMeetingId) {
      setError("Choose a meeting to continue.");
      return;
    }
    if (!sessionId) {
      setError("Chat session is unavailable. Refresh and try again.");
      return;
    }
    if (!toolResultId) {
      setError("Selection is not ready yet. Wait a moment or refresh the page.");
      return;
    }

    setPending(confirmKey, true);
    setError(null);

    try {
      const selectedMeeting = picker?.meetings.find((meeting) => meeting.id === selectedMeetingId);
      const result = await confirmMeetingPickerSelection({
        sessionId,
        toolResultId,
        selectedMeetingId,
        toolOutput: tool.output,
        toolInput: tool.input,
        pickerToolName: "select_meeting_for_action",
        onSubmitText,
        meetingTitle: selectedMeeting?.title,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      markContinued();
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
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled={pending || !selectedMeetingId || !toolResultId || !sessionId}
            onClick={() => void handleConfirm()}
          >
            {pending ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
            Confirm
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => void handleDismiss()}
          >
            Cancel
          </Button>
        </div>
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
