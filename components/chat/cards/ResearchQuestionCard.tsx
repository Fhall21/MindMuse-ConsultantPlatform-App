"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useCardConfirm } from "@/components/chat/card-confirm-context";
import { CARD_DISMISSED_COPY, CARD_REOPEN_HELP } from "@/lib/chat/onboarding-copy";
import {
  readResearchQuestionReviewOutput,
  type ResearchQuestionReviewOutput,
} from "@/lib/chat/tools/async-actions";
import { ChatToolCardShell } from "./chat-tool-card-shell";
import type { ChatCardProps } from "./types";

export function ResearchQuestionCard({
  tool,
  messageId,
  sessionId,
  onUpdated,
}: ChatCardProps) {
  const initialReview = useMemo(
    () => readResearchQuestionReviewOutput(tool.output),
    [tool.output]
  );
  const { isPending, setPending } = useCardConfirm();
  const confirmKey = `research-questions:${messageId}`;

  const [review, setReview] = useState<ResearchQuestionReviewOutput | null>(initialReview);
  const [completed, setCompleted] = useState(false);
  const status = tool.status ?? "pending";
  const toolResultId = tool.toolResultId;
  const confirming = isPending(confirmKey);

  useEffect(() => {
    if (initialReview) setReview(initialReview);
  }, [initialReview]);

  const persist = useCallback(
    async (next: ResearchQuestionReviewOutput, nextStatus?: "pending" | "success") => {
      if (!toolResultId || !sessionId) return;
      await fetch(`/api/chat/tool-results/${toolResultId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          status: nextStatus ?? "pending",
          consultation_id: next.consultation_id,
          questions: next.questions,
          dismissed_question_ids: next.dismissed_question_ids,
        }),
      });
    },
    [sessionId, toolResultId]
  );

  if (!review) return null;

  const activeQuestions = review.questions.filter(
    (question) => !review.dismissed_question_ids.includes(question.id)
  );

  if (status === "success" || completed) {
    return (
      <ChatToolCardShell
        success
        title="Research questions saved"
        description={`${activeQuestions.length} question${activeQuestions.length === 1 ? "" : "s"} kept for follow-up.`}
        successHelp={CARD_REOPEN_HELP}
      />
    );
  }

  if (status === "dismissed") {
    return (
      <ChatToolCardShell dismissed title="Research questions dismissed" description={CARD_DISMISSED_COPY} />
    );
  }

  async function toggleDismiss(questionId: string, keep: boolean) {
    const dismissed = keep
      ? review!.dismissed_question_ids.filter((id) => id !== questionId)
      : Array.from(new Set([...review!.dismissed_question_ids, questionId]));
    const next = { ...review!, dismissed_question_ids: dismissed };
    setReview(next);
    await persist(next);
  }

  async function handleDone() {
    if (!review || !sessionId || !toolResultId) return;
    setPending(confirmKey, true);
    try {
      await persist(review, "success");
      setCompleted(true);
      onUpdated?.();
    } finally {
      setPending(confirmKey, false);
    }
  }

  async function handleDismiss() {
    if (!toolResultId || !sessionId) return;
    await fetch(`/api/chat/tool-results/${toolResultId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, status: "dismissed" }),
    });
    onUpdated?.();
  }

  return (
    <ChatToolCardShell
      maxWidth="2xl"
      title="Research questions"
      description="Dismiss questions you do not need. Remaining items save on confirm."
      onDismiss={() => void handleDismiss()}
      dismissDisabled={confirming}
      footer={
        <>
          <Button variant="outline" onClick={() => void handleDismiss()} disabled={confirming}>
            Dismiss
          </Button>
          <Button onClick={() => void handleDone()} disabled={confirming}>
            {confirming ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Confirm questions"
            )}
          </Button>
        </>
      }
    >
      {review.questions.map((question) => {
        const dismissed = review.dismissed_question_ids.includes(question.id);
        return (
          <div
            key={question.id}
            className={`rounded-md border px-3 py-2 ${dismissed ? "opacity-50" : ""}`}
          >
            <label className="flex items-start gap-3">
              <Checkbox
                checked={!dismissed}
                disabled={confirming}
                onCheckedChange={(value) => void toggleDismiss(question.id, value === true)}
              />
              <span className="min-w-0 space-y-1">
                <span className="block text-sm font-medium">{question.question}</span>
                <span className="block text-xs text-muted-foreground">{question.rationale}</span>
              </span>
            </label>
          </div>
        );
      })}
    </ChatToolCardShell>
  );
}
