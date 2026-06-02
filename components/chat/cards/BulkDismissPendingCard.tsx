"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCardConfirm } from "@/components/chat/card-confirm-context";
import { formatPendingItemLabel, readBulkDismissProposal } from "@/lib/chat/tools/nl-actions";
import { ChatToolCardShell } from "./chat-tool-card-shell";
import type { ChatCardProps } from "./types";

export function BulkDismissPendingCard({ tool, sessionId, onUpdated }: ChatCardProps) {
  const proposal = useMemo(() => readBulkDismissProposal(tool.output), [tool.output]);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isPending, setPending } = useCardConfirm();
  const confirmKey = `bulk-dismiss:${tool.toolResultId ?? "unknown"}`;
  const confirming = isPending(confirmKey);

  if (!proposal) return null;
  if (completed || tool.status === "success") {
    return (
      <ChatToolCardShell
        success
        title="Pending items dismissed"
        description="Removed the selected pending work from this conversation."
      />
    );
  }

  async function handleConfirm() {
    if (!sessionId || !tool.toolResultId) return;
    setPending(confirmKey, true);
    setError(null);
    try {
      const response = await fetch("/api/chat/tool-results/bulk-dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          toolResultId: tool.toolResultId,
          itemIds: proposal!.items.map((item) => item.id),
        }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(data?.detail ?? "Could not dismiss pending items");
      }
      setCompleted(true);
      onUpdated?.();
    } catch (dismissError) {
      setError(dismissError instanceof Error ? dismissError.message : "Could not dismiss pending items");
    } finally {
      setPending(confirmKey, false);
    }
  }

  return (
    <ChatToolCardShell
      title="Dismiss pending items?"
      description={`This removes ${proposal.items.length} pending item${proposal.items.length === 1 ? "" : "s"} from this conversation. This cannot be undone.`}
      error={error}
      footer={
        <Button size="sm" variant="destructive" disabled={confirming || proposal.items.length === 0} onClick={() => void handleConfirm()}>
          {confirming ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Dismiss pending items
        </Button>
      }
    >
      <ul className="space-y-1 text-sm text-muted-foreground">
        {proposal.items.map((item) => (
          <li key={item.id}>{formatPendingItemLabel(item.tool_name)}</li>
        ))}
      </ul>
    </ChatToolCardShell>
  );
}
