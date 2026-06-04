"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCardConfirm } from "@/components/chat/card-confirm-context";
import {
  getCardSuccessShellProps,
  readMeetingIdFromToolInput,
} from "@/lib/chat/card-success-destinations";
import { readThemeEditOutput } from "@/lib/chat/tools/theme-edit";
import { ChatToolCardShell } from "./chat-tool-card-shell";
import { notifyCardConfirmation } from "./notify-card-confirmation";
import type { ChatCardProps } from "./types";

export function ThemeEditCard({ tool, messageId, sessionId, onUpdated }: ChatCardProps) {
  const data = useMemo(() => readThemeEditOutput(tool.output), [tool.output]);
  const { isPending, setPending } = useCardConfirm();
  const confirmKey = `theme-edit:${messageId}`;
  const confirming = isPending(confirmKey);

  const [label, setLabel] = useState(data?.label ?? "");
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  if (tool.status === "error") {
    return (
      <ChatToolCardShell
        title="Edit theme"
        description="Could not load theme"
        error="Couldn't update that theme. Try again."
      />
    );
  }

  if (!data) {
    return (
      <ChatToolCardShell
        title="Edit theme"
        description="This theme has been deleted or is no longer accessible."
      />
    );
  }

  if (completed || tool.status === "success") {
    const { successLink } = getCardSuccessShellProps(tool.toolName, {
      output: tool.output,
      meetingId: readMeetingIdFromToolInput(tool.input),
    });
    return (
      <ChatToolCardShell
        success
        title="Theme updated"
        description={label || data.label}
        successLink={successLink}
      />
    );
  }

  async function handleConfirm() {
    if (!data || !sessionId || !label.trim()) return;
    setPending(confirmKey, true);
    setError(null);

    try {
      const response = await fetch(`/api/client/insights/${data.insight_id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-chat-session-id": sessionId,
        },
        body: JSON.stringify({ label: label.trim() }),
      });

      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error((json as { detail?: string }).detail ?? "Failed to update theme");
      }

      await notifyCardConfirmation(sessionId, "theme_updated", tool.toolResultId);
      setCompleted(true);
      onUpdated?.();
    } catch (err) {
      setError(
        `Couldn't update that theme — ${err instanceof Error ? err.message : "unknown error"}. Try again.`
      );
    } finally {
      setPending(confirmKey, false);
    }
  }

  return (
    <ChatToolCardShell
      title="Edit theme"
      description={data.label}
      error={error}
      footer={
        <Button
          type="button"
          size="sm"
          disabled={confirming || !label.trim()}
          onClick={handleConfirm}
        >
          {confirming ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
          Save
        </Button>
      }
    >
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Theme label</Label>
        <Input
          className="h-8 text-sm"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && label.trim() && !confirming) handleConfirm();
          }}
          autoFocus
        />
      </div>
    </ChatToolCardShell>
  );
}
