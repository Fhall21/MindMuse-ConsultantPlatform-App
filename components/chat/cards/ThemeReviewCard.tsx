"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
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
import { INSIGHT_ACCEPT_COPY, INSIGHT_REVIEW_DONE_COPY } from "@/lib/chat/onboarding-copy";
import { cn } from "@/lib/utils";
import {
  getConfidenceLabel,
  type ThemeDecision,
  type ThemeReviewItem,
} from "@/lib/chat/tools/themes";
import { readThemeReviewOutput, type ChatCardProps } from "./types";

function ThemeRow({
  theme,
  decision,
  meetingId,
  sessionId,
  toolResultId,
  disabled,
  onDecision,
}: {
  theme: ThemeReviewItem;
  decision?: ThemeDecision;
  meetingId: string;
  sessionId: string;
  toolResultId: string;
  disabled: boolean;
  onDecision: (themeId: string, next: ThemeDecision, error: string | null) => void;
}) {
  const [rowPending, setRowPending] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const isAccepted = decision === "accepted";
  const isRejected = decision === "rejected";
  const confidence = getConfidenceLabel(theme.confidence);

  async function patchStatus(status: ThemeDecision) {
    setRowPending(true);
    setRowError(null);

    try {
      const response = await fetch(`/api/themes/${theme.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meeting_id: meetingId,
          status,
          session_id: sessionId,
          tool_result_id: toolResultId,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as
          | { detail?: string }
          | null;
        throw new Error(data?.detail ?? "Could not update theme");
      }

      onDecision(theme.id, status, null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not update theme";
      setRowError(message);
      onDecision(theme.id, status, message);
    } finally {
      setRowPending(false);
    }
  }

  const rowBusy = disabled || rowPending;

  return (
    <div
      className={cn(
        "rounded-lg border p-4 transition-opacity",
        isRejected && "border-border/60 bg-muted/20 opacity-90",
        isAccepted && "border-emerald-500/30 bg-emerald-500/5"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p
            className={cn(
              "font-medium leading-snug",
              isRejected && "text-muted-foreground line-through"
            )}
          >
            {theme.label}
          </p>
          {theme.description ? (
            <p
              className={cn(
                "text-sm text-muted-foreground",
                isRejected && "line-through"
              )}
            >
              {theme.description}
            </p>
          ) : null}
        </div>
        <div className="shrink-0">
          {decision === "accepted" ? (
            <Badge className="border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-200">
              Accepted
            </Badge>
          ) : decision === "rejected" ? (
            <Badge variant="outline" className="text-muted-foreground">
              Rejected
            </Badge>
          ) : (
            <Badge variant="outline" className={confidence.className}>
              {confidence.label}
            </Badge>
          )}
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
            onClick={() => void patchStatus("accepted")}
          >
            {rowPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Accept
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={rowBusy}
            onClick={() => void patchStatus("rejected")}
          >
            Reject
          </Button>
        </div>
      ) : isAccepted ? (
        <p className="mt-3 text-xs text-muted-foreground">{INSIGHT_ACCEPT_COPY}</p>
      ) : null}
    </div>
  );
}

export function ThemeReviewCard({
  tool,
  messageId,
  sessionId,
  onUpdated,
}: ChatCardProps) {
  const initialReview = useMemo(() => readThemeReviewOutput(tool.output), [tool.output]);
  const { isPending, setPending } = useCardConfirm();
  const confirmKey = `theme-review:${messageId}`;

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
          themes: nextReview.themes,
          theme_decisions: nextReview.decisions,
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
          <CardTitle>Theme review complete</CardTitle>
          <CardDescription>
            {INSIGHT_REVIEW_DONE_COPY(acceptedCount)}
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
          : "Could not finalize theme review"
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

  function handleDecision(themeId: string, next: ThemeDecision, rowError: string | null) {
    if (rowError) {
      return;
    }

    setReview((current) =>
      current
        ? {
            ...current,
            decisions: { ...current.decisions, [themeId]: next },
          }
        : current
    );
  }

  return (
    <Card size="sm" className="max-w-2xl">
      <CardHeader className="border-b">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Review extracted themes</CardTitle>
            <CardDescription>
              Accept or reject each finding. Decisions save immediately.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Dismiss theme review"
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

        {review.themes.map((theme) => (
          <ThemeRow
            key={theme.id}
            theme={theme}
            decision={review.decisions[theme.id]}
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
