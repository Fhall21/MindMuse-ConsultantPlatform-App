"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCardConfirm } from "@/components/chat/card-confirm-context";
import { ThemeReviewRow } from "@/components/insights/theme-review-row";
import {
  CARD_DISMISSED_COPY,
  CARD_REOPEN_HELP,
  INSIGHT_ACCEPT_COPY,
  INSIGHT_REVIEW_DONE_COPY,
} from "@/lib/chat/onboarding-copy";
import type { ThemeDecision, ThemeReviewItem } from "@/lib/chat/tools/themes";
import { ChatToolCardShell } from "./chat-tool-card-shell";
import { readThemeReviewOutput, type ChatCardProps } from "./types";

function ThemeReviewRowContainer({
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

  return (
    <ThemeReviewRow
      label={theme.label}
      description={theme.description}
      confidence={theme.confidence}
      decision={decision}
      isBusy={disabled || rowPending}
      error={rowError}
      acceptHelperText={decision === "accepted" ? INSIGHT_ACCEPT_COPY : undefined}
      onAccept={decision ? undefined : () => void patchStatus("accepted")}
      onReject={decision ? undefined : () => void patchStatus("rejected")}
    />
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
      <ChatToolCardShell
        success
        title="Theme review complete"
        description={INSIGHT_REVIEW_DONE_COPY(acceptedCount)}
        successHelp={CARD_REOPEN_HELP}
      />
    );
  }

  if (status === "dismissed") {
    return (
      <ChatToolCardShell
        dismissed
        title="Theme review dismissed"
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
    <ChatToolCardShell
      maxWidth="2xl"
      title="Review extracted themes"
      description="Accept or reject each finding. Decisions save immediately."
      error={error}
      onDismiss={() => void handleDismiss()}
      dismissLabel="Dismiss theme review"
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
      {review.themes.map((theme) => (
        <ThemeReviewRowContainer
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
    </ChatToolCardShell>
  );
}
