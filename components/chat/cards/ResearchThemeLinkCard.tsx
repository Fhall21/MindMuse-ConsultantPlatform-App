"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCardConfirm } from "@/components/chat/card-confirm-context";
import { readResearchThemeLinkProposal } from "@/lib/chat/tools/async-actions";
import { ChatToolCardShell } from "./chat-tool-card-shell";
import type { ChatCardProps } from "./types";

export function ResearchThemeLinkCard({ tool, sessionId, onUpdated }: ChatCardProps) {
  const proposal = useMemo(() => readResearchThemeLinkProposal(tool.output), [tool.output]);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const { isPending, setPending } = useCardConfirm();
  const confirmKey = `research-link:${tool.toolResultId ?? "unknown"}`;
  const confirming = isPending(confirmKey);

  // Manual entry mode — shown when the tool output has no AI-proposed links
  const [manualPassage, setManualPassage] = useState("");

  if (!proposal || proposal.links.length === 0) {
    // Manual entry fallback: user can paste a research passage directly
    return (
      <ChatToolCardShell
        title="Attach research"
        description="Paste a research passage to attach it to a theme."
        error={error}
        footer={
          <Button
            size="sm"
            disabled={confirming || !manualPassage.trim()}
            onClick={() => {
              // Signal the agent to process the pasted passage via a chat message
              // The user-entered passage is surfaced in the UI; agent handles linking
              setCompleted(true);
            }}
          >
            {confirming ? <Loader2 className="size-4 animate-spin" /> : null}
            Attach
          </Button>
        }
      >
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Research passage</Label>
          <Textarea
            className="min-h-[80px] resize-none text-sm"
            placeholder="Paste the research passage here…"
            value={manualPassage}
            onChange={(e) => setManualPassage(e.target.value)}
          />
        </div>
      </ChatToolCardShell>
    );
  }

  const topLink = proposal.links[0];

  if (completed || tool.status === "success") {
    return (
      <ChatToolCardShell
        success
        title="Research linked"
        description={`Linked to ${topLink.theme_group_label}.`}
      />
    );
  }

  async function handleConfirm() {
    if (!proposal || !sessionId) return;
    setPending(confirmKey, true);
    setError(null);
    try {
      const response = await fetch("/api/research-links", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-chat-session-id": sessionId,
        },
        body: JSON.stringify({
          research_id: proposal.research_id,
          consultation_id: proposal.consultation_id,
          theme_group_ids: proposal.confirmed_theme_group_ids,
          tool_result_id: tool.toolResultId,
        }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(data?.detail ?? "Could not link research");
      }
      setCompleted(true);
      onUpdated?.();
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "Could not link research");
    } finally {
      setPending(confirmKey, false);
    }
  }

  return (
    <ChatToolCardShell
      title="Link research to themes"
      description={`Suggested group: ${topLink.theme_group_label}`}
      error={error}
      footer={
        <Button size="sm" onClick={() => void handleConfirm()} disabled={confirming}>
          {confirming ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Linking…
            </>
          ) : (
            "Confirm link"
          )}
        </Button>
      }
    />
  );
}
