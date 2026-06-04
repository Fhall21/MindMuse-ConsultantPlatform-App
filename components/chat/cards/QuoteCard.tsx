"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCardConfirm } from "@/components/chat/card-confirm-context";
import { ChatQuoteReviewRow } from "@/components/quotes/chat-quote-review-row";
import { getCardSuccessShellProps } from "@/lib/chat/card-success-destinations";
import { CARD_DISMISSED_COPY, QUOTE_REVIEW_COMPLETE_COPY } from "@/lib/chat/onboarding-copy";
import {
  formatTranscriptPosition,
  type QuoteDecision,
  type QuoteReviewItem,
} from "@/lib/chat/tools/quotes";
import { ChatToolCardShell } from "./chat-tool-card-shell";
import { readQuoteReviewOutput, type ChatCardProps } from "./types";

function QuoteReviewRowContainer({
  quote,
  decision,
  meetingId,
  sessionId,
  toolResultId,
  disabled,
  onDecision,
}: {
  quote: QuoteReviewItem;
  decision?: QuoteDecision;
  meetingId: string;
  sessionId: string;
  toolResultId: string;
  disabled: boolean;
  onDecision: (quoteId: string, next: QuoteDecision, error: string | null) => void;
}) {
  const [rowPending, setRowPending] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  async function patchDecision(status: QuoteDecision) {
    setRowPending(true);
    setRowError(null);

    try {
      if (status === "accepted") {
        const response = await fetch("/api/quotes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            meeting_id: meetingId,
            card_quote_id: quote.id,
            theme_id: quote.theme_id,
            text: quote.text,
            span_start: quote.span_start,
            span_end: quote.span_end,
            speaker: quote.speaker,
            session_id: sessionId,
            tool_result_id: toolResultId,
          }),
        });

        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as
            | { detail?: string }
            | null;
          throw new Error(data?.detail ?? "Could not save quote");
        }
      } else {
        const response = await fetch(`/api/chat/tool-results/${toolResultId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            quote_decisions: { [quote.id]: "dismissed" },
          }),
        });

        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as
            | { detail?: string }
            | null;
          throw new Error(data?.detail ?? "Could not dismiss quote");
        }
      }

      onDecision(quote.id, status, null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not update quote";
      setRowError(message);
      onDecision(quote.id, status, message);
    } finally {
      setRowPending(false);
    }
  }

  return (
    <ChatQuoteReviewRow
      text={quote.text}
      speaker={quote.speaker}
      positionLabel={formatTranscriptPosition(quote.span_start, quote.span_end)}
      themeLabel={quote.theme_label}
      decision={decision}
      isBusy={disabled || rowPending}
      error={rowError}
      onAccept={decision ? undefined : () => void patchDecision("accepted")}
      onDismiss={decision ? undefined : () => void patchDecision("dismissed")}
    />
  );
}

export function QuoteCard({
  tool,
  messageId,
  sessionId,
  onUpdated,
}: ChatCardProps) {
  const initialReview = useMemo(() => readQuoteReviewOutput(tool.output), [tool.output]);
  const { isPending, setPending } = useCardConfirm();
  const confirmKey = `quote-review:${messageId}`;

  const [review, setReview] = useState(initialReview);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  const status = tool.status ?? "pending";
  const toolResultId = tool.toolResultId;
  const confirming = isPending(confirmKey);

  useEffect(() => {
    if (initialReview) {
      setReview(initialReview);
    }
  }, [initialReview]);

  const persistReviewState = useCallback(
    async (nextReview: NonNullable<typeof review>, nextStatus?: "pending" | "success") => {
      if (!toolResultId || !sessionId) {
        return;
      }

      await fetch(`/api/chat/tool-results/${toolResultId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          status: nextStatus ?? "pending",
          meeting_id: nextReview.meeting_id,
          quotes: nextReview.quotes,
          quote_decisions: nextReview.decisions,
          db_quote_ids: nextReview.db_quote_ids,
        }),
      });
    },
    [sessionId, toolResultId]
  );

  if (!review) {
    return null;
  }

  if (status === "success" || completed) {
    const acceptedCount = Object.values(review.decisions).filter(
      (value) => value === "accepted"
    ).length;
    const { successLink } = getCardSuccessShellProps(tool.toolName, {
      output: tool.output,
      meetingId: review.meeting_id,
    });

    return (
      <ChatToolCardShell
        success
        title={
          <span className="flex items-center gap-2">
            <Quote className="size-4" />
            Quote review complete
          </span>
        }
        description={
          acceptedCount > 0
            ? QUOTE_REVIEW_COMPLETE_COPY(acceptedCount)
            : "Review finished with no quotes saved."
        }
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
    if (!review) {
      return;
    }

    if (!sessionId || !toolResultId) {
      setError("Chat session is unavailable. Refresh and try again.");
      return;
    }

    setPending(confirmKey, true);
    setError(null);

    try {
      await persistReviewState(review, "success");
      setCompleted(true);
      setPending(confirmKey, false);
      onUpdated?.();
    } catch (doneError) {
      setError(
        doneError instanceof Error
          ? doneError.message
          : "Could not finalize quote review"
      );
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

  function handleDecision(quoteId: string, next: QuoteDecision, rowError: string | null) {
    if (rowError) {
      return;
    }

    setReview((current) =>
      current
        ? {
            ...current,
            decisions: { ...current.decisions, [quoteId]: next },
          }
        : current
    );
  }

  return (
    <ChatToolCardShell
      maxWidth="2xl"
      title="Review supporting quotes"
      description="Accept quotes to link evidence to insights. Each decision saves immediately."
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
                <Loader2 className="size-4 animate-spin" />
                Finishing…
              </>
            ) : (
              "Done reviewing"
            )}
          </Button>
        </>
      }
    >
      {review.quotes.map((quote) => (
        <QuoteReviewRowContainer
          key={quote.id}
          quote={quote}
          decision={review.decisions[quote.id]}
          meetingId={review.meeting_id}
          sessionId={sessionId ?? ""}
          toolResultId={toolResultId ?? ""}
          disabled={confirming || !sessionId || !toolResultId}
          onDecision={handleDecision}
        />
      ))}
    </ChatToolCardShell>
  );
}
