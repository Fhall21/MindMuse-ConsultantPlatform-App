"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Quote, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useCardConfirm } from "@/components/chat/card-confirm-context";
import { QUOTE_REVIEW_COMPLETE_COPY } from "@/lib/chat/onboarding-copy";
import { cn } from "@/lib/utils";
import {
  formatTranscriptPosition,
  type QuoteDecision,
  type QuoteReviewItem,
} from "@/lib/chat/tools/quotes";
import { readQuoteReviewOutput, type ChatCardProps } from "./types";

function QuoteRow({
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
  const isAccepted = decision === "accepted";
  const isDismissed = decision === "dismissed";

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

  const rowBusy = disabled || rowPending;

  return (
    <div
      className={cn(
        "rounded-lg border p-4 transition-opacity",
        isDismissed && "border-border/60 bg-muted/20 opacity-80",
        isAccepted && "border-emerald-500/30 bg-emerald-500/5"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <blockquote className="border-l-2 border-muted-foreground/30 pl-3 text-sm leading-relaxed text-foreground">
            {quote.text}
          </blockquote>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {quote.speaker ? (
              <span className="font-medium text-foreground/80">{quote.speaker}</span>
            ) : null}
            <span>{formatTranscriptPosition(quote.span_start, quote.span_end)}</span>
          </div>
        </div>
        <div className="shrink-0 space-y-2 text-right">
          <Badge variant="outline" className="max-w-[12rem] truncate">
            {quote.theme_label}
          </Badge>
          {decision === "accepted" ? (
            <Badge className="border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-200">
              Saved
            </Badge>
          ) : decision === "dismissed" ? (
            <Badge variant="outline" className="text-muted-foreground">
              Dismissed
            </Badge>
          ) : null}
        </div>
      </div>

      {rowError ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {rowError}
        </p>
      ) : null}

      {!decision ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled={rowBusy}
            onClick={() => void patchDecision("accepted")}
          >
            {rowPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Accept
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={rowBusy}
            onClick={() => void patchDecision("dismissed")}
          >
            Dismiss
          </Button>
        </div>
      ) : null}
    </div>
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

    return (
      <Card size="sm" className="border-emerald-500/30 bg-emerald-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Quote className="size-4" />
            Quote review complete
          </CardTitle>
          <CardDescription>
            {acceptedCount > 0
              ? QUOTE_REVIEW_COMPLETE_COPY(acceptedCount)
              : "Review finished with no quotes saved."}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (status === "dismissed") {
    return null;
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
    <Card size="sm" className="max-w-2xl">
      <CardHeader className="border-b">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Review supporting quotes</CardTitle>
            <CardDescription>
              Accept quotes to link evidence to insights. Each decision saves immediately.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Dismiss quote review"
            onClick={() => void handleDismiss()}
            disabled={confirming}
          >
            <X className="size-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-4">
        {error ? (
          <div
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </div>
        ) : null}

        {review.quotes.map((quote) => (
          <QuoteRow
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
      </CardContent>

      <CardFooter className="justify-end gap-2 border-t">
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
      </CardFooter>
    </Card>
  );
}
