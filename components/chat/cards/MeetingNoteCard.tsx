"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCardConfirm } from "@/components/chat/card-confirm-context";
import { readMeetingNoteProposal } from "@/lib/chat/tools/nl-actions";
import { ChatToolCardShell } from "./chat-tool-card-shell";
import type { ChatCardProps } from "./types";

export function MeetingNoteCard({ tool, sessionId, onUpdated }: ChatCardProps) {
  const proposal = useMemo(() => readMeetingNoteProposal(tool.output), [tool.output]);
  const [note, setNote] = useState(proposal?.note ?? "");
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isPending, setPending } = useCardConfirm();
  const confirmKey = `meeting-note:${tool.toolResultId ?? "unknown"}`;
  const confirming = isPending(confirmKey);

  if (!proposal) return null;

  if (completed || tool.status === "success") {
    return (
      <ChatToolCardShell
        success
        title="Meeting note saved"
        description={`Added the note to ${proposal.meeting_title}.`}
      />
    );
  }

  async function handleConfirm() {
    if (!sessionId || !tool.toolResultId || !note.trim()) return;
    setPending(confirmKey, true);
    setError(null);
    try {
      const response = await fetch("/api/chat/meeting-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          toolResultId: tool.toolResultId,
          note,
        }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(data?.detail ?? "Could not save note");
      }
      setCompleted(true);
      onUpdated?.();
    } catch (noteError) {
      setError(noteError instanceof Error ? noteError.message : "Could not save note");
    } finally {
      setPending(confirmKey, false);
    }
  }

  return (
    <ChatToolCardShell
      title="Add meeting note"
      description={`Review the note before saving it to ${proposal.meeting_title}.`}
      error={error}
      footer={
        <Button size="sm" disabled={confirming || !note.trim()} onClick={() => void handleConfirm()}>
          {confirming ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Save note
        </Button>
      }
    >
      <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} />
    </ChatToolCardShell>
  );
}
