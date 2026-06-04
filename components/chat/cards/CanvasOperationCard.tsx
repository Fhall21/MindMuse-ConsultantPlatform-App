"use client";

import { useState } from "react";
import { ArrowRight, Loader2, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCardConfirm } from "@/components/chat/card-confirm-context";
import { getCardSuccessShellProps } from "@/lib/chat/card-success-destinations";
import { readCanvasOperationProposal } from "@/lib/chat/tools/canvas-manipulate";
import { ChatToolCardShell } from "./chat-tool-card-shell";
import { notifyCardConfirmation } from "./notify-card-confirmation";
import type { ChatCardProps } from "./types";

export function CanvasOperationCard({ tool, messageId, sessionId, onUpdated }: ChatCardProps) {
  const proposal = readCanvasOperationProposal(tool.output);
  const { isPending, setPending } = useCardConfirm();
  const confirmKey = `canvas-op:${messageId}`;
  const confirming = isPending(confirmKey);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (tool.status === "error") {
    return (
      <ChatToolCardShell
        title="Canvas operation"
        description="Could not prepare operation"
        error="Canvas operation failed. Try again."
      />
    );
  }

  if (!proposal) {
    return (
      <ChatToolCardShell
        title="Canvas operation"
        description="Operation details unavailable."
      />
    );
  }

  if (completed || tool.status === "success") {
    const successDesc =
      proposal.operation === "connect"
        ? `"${proposal.source_node_label}" → "${proposal.target_node_label}"`
        : `"${proposal.node_label}" renamed to "${proposal.new_label}"`;
    const { successLink } = getCardSuccessShellProps(tool.toolName, {
      output: tool.output,
      consultationId: proposal.consultation_id,
    });
    return (
      <ChatToolCardShell
        success
        title={proposal.operation === "connect" ? "Nodes connected" : "Frame renamed"}
        description={successDesc}
        successLink={successLink}
      />
    );
  }

  if (dismissed) {
    return (
      <ChatToolCardShell
        dismissed
        title={proposal.operation === "connect" ? "Connect nodes" : "Rename frame"}
        description="Cancelled"
      />
    );
  }

  async function handleConfirm() {
    if (!proposal || !sessionId) return;
    setPending(confirmKey, true);
    setError(null);

    try {
      if (proposal.operation === "connect") {
        if (!proposal.source_node_id || !proposal.target_node_id) {
          throw new Error("Missing node IDs for connection");
        }
        const response = await fetch(
          `/api/client/consultations/${proposal.consultation_id}/canvas/edges`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-chat-session-id": sessionId,
            },
            body: JSON.stringify({
              from_node_type: proposal.source_node_type ?? "theme",
              from_node_id: proposal.source_node_id,
              to_node_type: proposal.target_node_type ?? "theme",
              to_node_id: proposal.target_node_id,
              connection_type: proposal.connection_type ?? "related_to",
            }),
          }
        );
        if (!response.ok) {
          const json = await response.json().catch(() => ({}));
          throw new Error((json as { detail?: string }).detail ?? "Failed to create connection");
        }
      } else {
        if (!proposal.node_id || !proposal.new_label) {
          throw new Error("Missing frame ID or new label");
        }
        const response = await fetch(
          `/api/client/consultations/${proposal.consultation_id}/canvas/frames/${proposal.node_id}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "x-chat-session-id": sessionId,
            },
            body: JSON.stringify({ label: proposal.new_label }),
          }
        );
        if (!response.ok) {
          const json = await response.json().catch(() => ({}));
          throw new Error((json as { detail?: string }).detail ?? "Failed to rename frame");
        }
      }

      await notifyCardConfirmation(sessionId, "canvas_updated", tool.toolResultId);
      setCompleted(true);
      onUpdated?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Canvas operation failed. Try again."
      );
    } finally {
      setPending(confirmKey, false);
    }
  }

  const isConnect = proposal.operation === "connect";
  const title = isConnect ? "Connect nodes" : "Rename frame";
  const description = isConnect
    ? `"${proposal.source_node_label ?? proposal.source_node_id}" → "${proposal.target_node_label ?? proposal.target_node_id}"`
    : `"${proposal.node_label ?? proposal.node_id}" → "${proposal.new_label}"`;

  return (
    <ChatToolCardShell
      title={title}
      description={description}
      error={error}
      onDismiss={() => setDismissed(true)}
      dismissDisabled={confirming}
      footer={
        <Button
          type="button"
          size="sm"
          disabled={confirming}
          onClick={handleConfirm}
        >
          {confirming ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
          Confirm
        </Button>
      }
    >
      <div className="space-y-2">
        {isConnect ? (
          <div className="flex items-center gap-2">
            <span className="rounded bg-muted px-2 py-1 text-xs font-medium">
              {proposal.source_node_label ?? proposal.source_node_id}
            </span>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
            <span className="rounded bg-muted px-2 py-1 text-xs font-medium">
              {proposal.target_node_label ?? proposal.target_node_id}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Tag className="size-4 shrink-0 text-muted-foreground" />
            <span className="text-xs text-muted-foreground line-through">
              {proposal.node_label ?? proposal.node_id}
            </span>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
            <span className="text-xs font-medium">{proposal.new_label}</span>
          </div>
        )}
        {isConnect && proposal.connection_type ? (
          <p className="text-xs text-muted-foreground">
            Type: {proposal.connection_type.replace(/_/g, " ")}
          </p>
        ) : null}
      </div>
    </ChatToolCardShell>
  );
}
