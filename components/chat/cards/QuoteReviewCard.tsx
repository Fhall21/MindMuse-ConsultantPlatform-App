"use client";

import { useMemo, useState } from "react";
import { Loader2, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCardConfirm } from "@/components/chat/card-confirm-context";
import { QuoteReviewPanel } from "@/components/consultations/quote-review-panel";
import { getCardSuccessShellProps } from "@/lib/chat/card-success-destinations";
import { CARD_DISMISSED_COPY } from "@/lib/chat/onboarding-copy";
import { readShowQuotesOutput } from "@/lib/chat/tools/quotes";
import { ChatToolCardShell } from "./chat-tool-card-shell";
import { readToolResultId, type ChatCardProps } from "./types";

export function QuoteReviewCard({
  tool,
  messageId,
  sessionId,
  onUpdated,
}: ChatCardProps) {
  const data = useMemo(() => readShowQuotesOutput(tool.output), [tool.output]);
  const { isPending, setPending } = useCardConfirm();
  const confirmKey = `quote-review-panel:${messageId}`;
  const confirming = isPending(confirmKey);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  const status = tool.status ?? "pending";
  const toolResultId = readToolResultId(tool);

  if (tool.status === "error" || !data) {
    return (
      <ChatToolCardShell
        title={
          <span className="flex items-center gap-2">
            <Quote className="size-4" />
            Quotes
          </span>
        }
        error="Meeting not found or unavailable."
      />
    );
  }

  if (status === "success" || completed) {
    const { successLink } = getCardSuccessShellProps(tool.toolName, {
      output: tool.output,
      meetingId: data.meeting_id,
    });
    return (
      <ChatToolCardShell
        success
        title={
          <span className="flex items-center gap-2">
            <Quote className="size-4" />
            {`Quotes — ${data.meeting_title}`}
          </span>
        }
        description="Quote review finished. Reopen this card from chat history if you need to add more."
        successLink={successLink}
      />
    );
  }

  if (status === "dismissed") {
    return (
      <ChatToolCardShell
        dismissed
        title="Quote review dismissed"
        description={CARD_DISMISSED_COPY}
      />
    );
  }

  async function handleDone() {
    if (!sessionId || !toolResultId) {
      setError("Chat session is unavailable. Refresh and try again.");
      return;
    }

    setPending(confirmKey, true);
    setError(null);

    try {
      const response = await fetch(`/api/chat/tool-results/${toolResultId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, status: "success" }),
      });

      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error((json as { detail?: string }).detail ?? "Could not finish quote review");
      }

      setCompleted(true);
      onUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not finish quote review");
    } finally {
      setPending(confirmKey, false);
    }
  }

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

  return (
    <ChatToolCardShell
      title={
        <span className="flex items-center gap-2">
          <Quote className="size-4" />
          {`Quotes — ${data.meeting_title}`}
        </span>
      }
      description="Highlight transcript text to capture a quote. Click Done when finished."
      maxWidth="5xl"
      error={error}
      onDismiss={() => void handleDismiss()}
      dismissLabel="Dismiss quote review"
      dismissDisabled={confirming}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleDismiss()}
            disabled={confirming}
          >
            Dismiss
          </Button>
          <Button type="button" onClick={() => void handleDone()} disabled={confirming}>
            {confirming ? (
              <>
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                Finishing…
              </>
            ) : (
              "Done reviewing"
            )}
          </Button>
        </>
      }
    >
      <div
        className="max-h-[70vh] overflow-y-auto overscroll-contain"
        onPointerDownCapture={(e) => e.stopPropagation()}
      >
        <QuoteReviewPanel meetingId={data.meeting_id} />
      </div>
    </ChatToolCardShell>
  );
}
