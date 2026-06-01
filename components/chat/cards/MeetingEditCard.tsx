"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCardConfirm } from "@/components/chat/card-confirm-context";
import { readMeetingEditOutput } from "@/lib/chat/tools/meeting-edit";
import { ChatToolCardShell } from "./chat-tool-card-shell";
import type { ChatCardProps } from "./types";

export function MeetingEditCard({ tool, messageId, sessionId, onUpdated }: ChatCardProps) {
  const data = useMemo(() => readMeetingEditOutput(tool.output), [tool.output]);
  const { isPending, setPending } = useCardConfirm();
  const confirmKey = `meeting-edit:${messageId}`;
  const confirming = isPending(confirmKey);

  const [title, setTitle] = useState(data?.title ?? "");
  const [date, setDate] = useState(
    data?.meeting_date ? data.meeting_date.slice(0, 10) : ""
  );
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  if (tool.status === "error") {
    return (
      <ChatToolCardShell
        title="Edit meeting"
        description="Could not load meeting"
        error="Meeting update failed. Try again."
      />
    );
  }

  if (!data) {
    return (
      <ChatToolCardShell
        title="Edit meeting"
        description="This meeting no longer exists or you don't have access."
      />
    );
  }

  if (completed || tool.status === "success") {
    return (
      <ChatToolCardShell
        success
        title="Meeting updated"
        description={title || data.title}
      />
    );
  }

  async function handleConfirm() {
    if (!data || !sessionId) return;
    setPending(confirmKey, true);
    setError(null);

    try {
      const body: Record<string, string> = {};
      if (title.trim() && title.trim() !== data.title) body.title = title.trim();
      if (date && date !== (data.meeting_date ?? "").slice(0, 10)) body.meeting_date = date;

      if (Object.keys(body).length === 0) {
        setPending(confirmKey, false);
        return;
      }

      const response = await fetch(`/api/client/meetings/${data.meeting_id}/metadata`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-chat-session-id": sessionId,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error((json as { detail?: string }).detail ?? "Failed to update meeting");
      }

      setCompleted(true);
      onUpdated?.();
    } catch (err) {
      setError(
        `Meeting update failed — ${err instanceof Error ? err.message : "unknown error"}. Try again.`
      );
    } finally {
      setPending(confirmKey, false);
    }
  }

  return (
    <ChatToolCardShell
      title="Edit meeting"
      description={data.title}
      error={error}
      footer={
        <Button
          type="button"
          size="sm"
          disabled={confirming}
          onClick={handleConfirm}
        >
          {confirming ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
          Save changes
        </Button>
      }
    >
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Title</Label>
          <Input
            className="h-8 text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Date</Label>
          <Input
            type="date"
            className="h-8 text-sm"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>
    </ChatToolCardShell>
  );
}
