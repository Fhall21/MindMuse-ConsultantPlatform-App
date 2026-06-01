"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCardConfirm } from "@/components/chat/card-confirm-context";
import { readPersonLinkOutput } from "@/lib/chat/tools/people-link";
import { ChatToolCardShell } from "./chat-tool-card-shell";
import type { ChatCardProps } from "./types";

export function PersonLinkCard({ tool, messageId, sessionId, onUpdated }: ChatCardProps) {
  const data = useMemo(() => readPersonLinkOutput(tool.output), [tool.output]);
  const { isPending, setPending } = useCardConfirm();
  const confirmKey = `person-link:${messageId}`;
  const confirming = isPending(confirmKey);

  const output = tool.output as Record<string, unknown> | null;
  const nameHint =
    typeof output?.person_name_hint === "string" ? output.person_name_hint : "";

  const [search, setSearch] = useState(nameHint);
  const [selectedId, setSelectedId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  if (tool.status === "error") {
    return (
      <ChatToolCardShell
        title="Link person"
        description="Could not load people"
        error="Couldn't link that person. Try again."
      />
    );
  }

  if (completed || tool.status === "success") {
    return (
      <ChatToolCardShell
        success
        title="Person linked"
        description="The person has been linked to this consultation."
      />
    );
  }

  if (!data) return null;

  const filtered = data.people.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const noResults = search.trim().length > 0 && filtered.length === 0;

  async function handleConfirm() {
    if (!data || !sessionId || !selectedId) return;
    setPending(confirmKey, true);
    setError(null);

    try {
      const response = await fetch(`/api/client/meetings/${data.meeting_id}/people`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-chat-session-id": sessionId,
        },
        body: JSON.stringify({ person_id: selectedId }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text);
      }

      setCompleted(true);
      onUpdated?.();
    } catch (err) {
      setError(
        `Couldn't link that person — ${err instanceof Error ? err.message : "unknown error"}. Try again.`
      );
    } finally {
      setPending(confirmKey, false);
    }
  }

  return (
    <ChatToolCardShell
      title="Link person"
      description="No one's linked to this consultation yet. Say 'Link [name]' to add someone."
      error={error}
      footer={
        <Button
          type="button"
          size="sm"
          disabled={confirming || !selectedId}
          onClick={handleConfirm}
        >
          {confirming ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
          Link person
        </Button>
      }
    >
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Search</Label>
          <Input
            className="h-8 text-sm"
            placeholder="Name…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedId("");
            }}
          />
        </div>

        {noResults ? (
          <p className="text-sm text-muted-foreground">
            No one found matching that name. Try a different spelling or ask me to create a new
            person.
          </p>
        ) : (
          <ul className="max-h-40 space-y-1 overflow-y-auto">
            {filtered.map((person) => (
              <li key={person.id}>
                <button
                  type="button"
                  className={`w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors ${
                    selectedId === person.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  }`}
                  onClick={() => setSelectedId(person.id)}
                >
                  {person.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ChatToolCardShell>
  );
}
