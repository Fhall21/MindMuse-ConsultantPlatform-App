"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCardConfirm } from "@/components/chat/card-confirm-context";
import { readInsightCreateOutput } from "@/lib/chat/tools/insight-create";
import { ChatToolCardShell } from "./chat-tool-card-shell";
import type { ChatCardProps } from "./types";

export function InsightCreateCard({ tool, messageId, sessionId, onUpdated }: ChatCardProps) {
  const data = useMemo(() => readInsightCreateOutput(tool.output), [tool.output]);
  const { isPending, setPending } = useCardConfirm();
  const confirmKey = `insight-create:${messageId}`;
  const confirming = isPending(confirmKey);

  const [label, setLabel] = useState(data?.label_hint ?? "");
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  if (tool.status === "error") {
    return (
      <ChatToolCardShell
        title="Add insight"
        description="Could not create insight"
        error="Couldn't save that insight. Try again."
      />
    );
  }

  if (completed || tool.status === "success") {
    return (
      <ChatToolCardShell
        success
        title="Insight added"
        description={label || "New insight added to the canvas."}
      />
    );
  }

  if (!data) return null;

  async function handleConfirm() {
    if (!data || !sessionId || !label.trim()) return;
    setPending(confirmKey, true);
    setError(null);

    try {
      const response = await fetch("/api/client/insights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-chat-session-id": sessionId,
        },
        body: JSON.stringify({
          meeting_id: data.meeting_id,
          label: label.trim(),
        }),
      });

      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error((json as { detail?: string }).detail ?? "Failed to create insight");
      }

      setCompleted(true);
      onUpdated?.();
    } catch (err) {
      setError(
        `Couldn't save that insight — ${err instanceof Error ? err.message : "unknown error"}. Try again.`
      );
    } finally {
      setPending(confirmKey, false);
    }
  }

  return (
    <ChatToolCardShell
      title="Add insight"
      description="Give this insight a label."
      error={error}
      footer={
        <Button
          type="button"
          size="sm"
          disabled={confirming || !label.trim()}
          onClick={handleConfirm}
        >
          {confirming ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
          Add insight
        </Button>
      }
    >
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Insight label</Label>
        <Input
          className="h-8 text-sm"
          placeholder="e.g. Trust deficit"
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
