"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCardConfirm } from "@/components/chat/card-confirm-context";
import {
  CARD_DISMISSED_COPY,
  CARD_REOPEN_HELP,
  GROUPING_CONFIRMED_COPY,
} from "@/lib/chat/onboarding-copy";
import { readGroupingReviewOutput, type GroupingReviewOutput } from "@/lib/chat/tools/grouping";
import { ChatToolCardShell } from "./chat-tool-card-shell";
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
        title="Theme group saved"
        description={GROUPING_CONFIRMED_COPY(review.group_name)}
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
      setError("Select at least one theme for this group.");
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
          tool_result_id: toolResultId,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(data?.detail ?? "Could not save theme group");
      }

      await persistReviewState(review, "success");
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

  function toggleTheme(themeId: string, checked: boolean) {
    const nextIds = checked
      ? Array.from(new Set([...review.theme_ids, themeId]))
      : review.theme_ids.filter((id) => id !== themeId);

    void patchReview({ ...review, theme_ids: nextIds });
  }

  return (
    <ChatToolCardShell
      maxWidth="2xl"
      title="Review theme group"
      description="Edit the group and choose which themes belong. Changes save immediately."
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
            ) : (
              "Confirm group"
            )}
          </Button>
        </>
      }
    >
      <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
        {review.rationale}
      </p>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor={`group-name-${messageId}`}>
            Group name
          </label>
          <Input
            id={`group-name-${messageId}`}
            value={review.group_name}
            disabled={confirming}
            onChange={(event) => {
              void patchReview({ ...review, group_name: event.target.value });
            }}
          />
        </div>

        <div className="space-y-1.5">
          <label
            className="text-xs font-medium text-muted-foreground"
            htmlFor={`group-description-${messageId}`}
          >
            Description
          </label>
          <Textarea
            id={`group-description-${messageId}`}
            value={review.group_description}
            disabled={confirming}
            rows={3}
            onChange={(event) => {
              void patchReview({ ...review, group_description: event.target.value });
            }}
          />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Themes in this group</p>
        {review.available_themes.map((theme) => {
          const checked = review.theme_ids.includes(theme.id);
          return (
            <label
              key={theme.id}
              className="flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2"
            >
              <Checkbox
                checked={checked}
                disabled={confirming}
                onCheckedChange={(value) => toggleTheme(theme.id, value === true)}
              />
              <span className="min-w-0 space-y-0.5">
                <span className="block text-sm font-medium">{theme.label}</span>
                {theme.description ? (
                  <span className="block text-xs text-muted-foreground">{theme.description}</span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>
    </ChatToolCardShell>
  );
}
