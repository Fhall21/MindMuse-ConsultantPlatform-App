"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCardConfirm } from "@/components/chat/card-confirm-context";
import { readPersonUnlinkProposal } from "@/lib/chat/tools/nl-actions";
import { ChatToolCardShell } from "./chat-tool-card-shell";
import { notifyCardConfirmation } from "./notify-card-confirmation";
import type { ChatCardProps } from "./types";

export function PersonUnlinkCard({ tool, sessionId, onUpdated }: ChatCardProps) {
  const proposal = useMemo(() => readPersonUnlinkProposal(tool.output), [tool.output]);
  const hintedPersonId = useMemo(() => {
    const hint = proposal?.person_name_hint?.toLowerCase();
    return hint
      ? proposal?.people.find((person) => person.name.toLowerCase().includes(hint))?.id ?? ""
      : "";
  }, [proposal]);
  const [selectedId, setSelectedId] = useState(hintedPersonId);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isPending, setPending } = useCardConfirm();
  const confirmKey = `person-unlink:${tool.toolResultId ?? "unknown"}`;
  const confirming = isPending(confirmKey);

  if (!proposal) return null;
  if (completed || tool.status === "success") {
    return (
      <ChatToolCardShell
        success
        title="Person unlinked"
        description={`Removed the meeting connection from ${proposal.meeting_title}.`}
      />
    );
  }

  async function handleConfirm() {
    if (!sessionId || !selectedId) return;
    setPending(confirmKey, true);
    setError(null);
    try {
      const response = await fetch(`/api/client/meetings/${proposal!.meeting_id}/people`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person_id: selectedId }),
      });
      if (!response.ok) throw new Error(await response.text());
      await notifyCardConfirmation(sessionId, "person_unlinked", tool.toolResultId);
      setCompleted(true);
      onUpdated?.();
    } catch (unlinkError) {
      setError(unlinkError instanceof Error ? unlinkError.message : "Could not unlink person");
    } finally {
      setPending(confirmKey, false);
    }
  }

  return (
    <ChatToolCardShell
      title="Unlink person from meeting"
      description={`Choose who to unlink from ${proposal.meeting_title}.`}
      error={error}
      footer={
        <Button size="sm" variant="destructive" disabled={!selectedId || confirming} onClick={() => void handleConfirm()}>
          {confirming ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Unlink person
        </Button>
      }
    >
      <div className="space-y-1">
        {proposal.people.map((person) => (
          <button
            key={person.id}
            type="button"
            onClick={() => setSelectedId(person.id)}
            className={`block w-full rounded-md border px-3 py-2 text-left text-sm ${
              selectedId === person.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
            }`}
          >
            {person.name}
          </button>
        ))}
      </div>
    </ChatToolCardShell>
  );
}
