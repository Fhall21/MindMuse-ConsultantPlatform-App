"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCardConfirm } from "@/components/chat/card-confirm-context";
import {
  CARD_DISMISSED_COPY,
  CARD_REOPEN_HELP,
  GROUPING_CONFIRMED_COPY,
  GROUPING_LINKED_COPY,
} from "@/lib/chat/onboarding-copy";
import { readGroupingReviewOutput, type GroupingReviewOutput } from "@/lib/chat/tools/grouping";
import { ChatThemeGroupingWorkspace } from "./chat-theme-grouping-workspace";
import { ChatToolCardShell } from "./chat-tool-card-shell";
import { notifyCardConfirmation } from "./notify-card-confirmation";
import type { ChatCardProps } from "./types";

export function ThemeGroupingCard({
  tool,
  messageId,
  sessionId,
  onUpdated,
}: ChatCardProps) {
  const initialReview = useMemo(() => readGroupingReviewOutput(tool.output), [tool.output]);
  const { isPending, setPending } = useCardConfirm();
  const confirmKey = `theme-grouping:${messageId}`;

  const [review, setReview] = useState<GroupingReviewOutput | null>(initialReview);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  const status = tool.status ?? "pending";
  const toolResultId = tool.toolResultId;
  const confirming = isPending(confirmKey);
  const isLinkMode = review?.mode === "link";

  useEffect(() => {
    if (initialReview) {
      setReview(initialReview);
    }
  }, [initialReview]);

  const persistReviewState = useCallback(
    async (nextReview: GroupingReviewOutput, nextStatus?: "pending" | "success") => {
      if (!toolResultId || !sessionId) {
        return;
      }

      await fetch(`/api/chat/tool-results/${toolResultId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          status: nextStatus ?? "pending",
          consultation_id: nextReview.consultation_id,
          mode: nextReview.mode,
          target_group_id: nextReview.target_group_id,
          group_name: nextReview.group_name,
          group_description: nextReview.group_description,
          theme_ids: nextReview.theme_ids,
          rationale: nextReview.rationale,
          available_themes: nextReview.available_themes,
        }),
      });
    },
    [sessionId, toolResultId]
  );

  if (!review) {
    return null;
  }

  if (status === "success" || completed) {
    return (
      <ChatToolCardShell
        success
        title={isLinkMode ? "Insights linked" : "Theme group saved"}
        description={
          isLinkMode
            ? GROUPING_LINKED_COPY(review.group_name, review.theme_ids.length)
            : GROUPING_CONFIRMED_COPY(review.group_name)
        }
        successHelp={CARD_REOPEN_HELP}
      />
    );
  }

  if (status === "dismissed") {
    return (
      <ChatToolCardShell
        dismissed
        title="Grouping dismissed"
        description={CARD_DISMISSED_COPY}
      />
    );
  }

  async function patchReview(nextReview: GroupingReviewOutput) {
    setReview(nextReview);
    try {
      await persistReviewState(nextReview);
    } catch {
      // Best-effort persistence; card state stays local.
    }
  }

  async function handleConfirm() {
    if (!review || !sessionId || !toolResultId) {
      setError("Chat session is unavailable. Refresh and try again.");
      return;
    }

    if (review.theme_ids.length < 1) {
      setError(
        isLinkMode
          ? "Select at least one insight to link."
          : "Select at least one theme for this group."
      );
      return;
    }

    if (isLinkMode && !review.target_group_id) {
      setError("Target group is missing. Ask the assistant to try again.");
      return;
    }

    setPending(confirmKey, true);
    setError(null);

    try {
      const response = await fetch("/api/theme-groups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-chat-session-id": sessionId,
        },
        body: JSON.stringify({
          consultation_id: review.consultation_id,
          group_name: review.group_name,
          group_description: review.group_description,
          theme_ids: review.theme_ids,
          target_group_id: review.target_group_id,
          tool_result_id: toolResultId,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(data?.detail ?? "Could not save theme group");
      }

      await persistReviewState(review, "success");
      await notifyCardConfirmation(sessionId, "theme_group_saved");
      setCompleted(true);
      onUpdated?.();
    } catch (confirmError) {
      setError(
        confirmError instanceof Error ? confirmError.message : "Could not save theme group"
      );
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
      maxWidth="5xl"
      title={isLinkMode ? "Link insights to group" : "Review theme group"}
      description={
        isLinkMode
          ? "Select insights on the left, then link them to the group on the right."
          : "Use the same grouping workspace as the consultation canvas — select themes, create or refine groups, then confirm."
      }
      error={error}
      onDismiss={() => void handleDismiss()}
      dismissLabel="Dismiss grouping"
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
          <Button type="button" onClick={() => void handleConfirm()} disabled={confirming}>
            {confirming ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving…
              </>
            ) : isLinkMode ? (
              "Link insights"
            ) : (
              "Confirm group"
            )}
          </Button>
        </>
      }
    >
      <ChatThemeGroupingWorkspace
        review={review}
        disabled={confirming}
        onReviewChange={(next) => void patchReview(next)}
      />
    </ChatToolCardShell>
  );
}
