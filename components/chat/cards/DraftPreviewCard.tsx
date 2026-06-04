"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCardConfirm } from "@/components/chat/card-confirm-context";
import { getCardSuccessShellProps } from "@/lib/chat/card-success-destinations";
import { CARD_DISMISSED_COPY, EMAIL_DRAFT_SAVED_COPY } from "@/lib/chat/onboarding-copy";
import { readEmailDraftReviewOutput, type EmailDraftReviewOutput } from "@/lib/chat/tools/async-actions";
import { ChatToolCardShell } from "./chat-tool-card-shell";
import { notifyCardConfirmation } from "./notify-card-confirmation";
import type { ChatCardProps } from "./types";

export function DraftPreviewCard({
  tool,
  messageId,
  sessionId,
  onUpdated,
}: ChatCardProps) {
  const initialReview = useMemo(() => readEmailDraftReviewOutput(tool.output), [tool.output]);
  const { isPending, setPending } = useCardConfirm();
  const confirmKey = `email-draft:${messageId}`;

  const [review, setReview] = useState<EmailDraftReviewOutput | null>(initialReview);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  const status = tool.status ?? "pending";
  const toolResultId = tool.toolResultId;
  const confirming = isPending(confirmKey);

  useEffect(() => {
    if (initialReview) setReview(initialReview);
  }, [initialReview]);

  const persist = useCallback(
    async (next: EmailDraftReviewOutput, nextStatus?: "pending" | "success") => {
      if (!toolResultId || !sessionId) return;
      await fetch(`/api/chat/tool-results/${toolResultId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          status: nextStatus ?? "pending",
          consultation_id: next.consultation_id,
          meeting_id: next.meeting_id,
          draft_id: next.draft_id,
          subject: next.subject,
          body: next.body,
          edited_body: next.edited_body,
          supporting_quotes: next.supporting_quotes,
          linked_themes: next.linked_themes,
        }),
      });
    },
    [sessionId, toolResultId]
  );

  if (!review) return null;

  const bodyToRender = review.edited_body ?? review.body;

  if (status === "success" || completed) {
    const { successLink } = getCardSuccessShellProps(tool.toolName, {
      output: tool.output,
      meetingId: review?.meeting_id,
    });
    return (
      <ChatToolCardShell
        success
        title="Evidence email saved"
        description={EMAIL_DRAFT_SAVED_COPY}
        successLink={successLink}
      />
    );
  }

  if (status === "dismissed") {
    return (
      <ChatToolCardShell dismissed title="Email draft dismissed" description={CARD_DISMISSED_COPY} />
    );
  }

  async function handleSave() {
    if (!review || !sessionId || !toolResultId) return;
    setPending(confirmKey, true);
    setError(null);
    try {
      const response = await fetch("/api/email-drafts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-chat-session-id": sessionId,
        },
        body: JSON.stringify({
          meeting_id: review.meeting_id,
          subject: review.subject,
          body: review.edited_body ?? review.body,
          draft_id: review.draft_id,
          tool_result_id: toolResultId,
        }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(data?.detail ?? "Could not save email draft");
      }
      await persist(review, "success");
      await notifyCardConfirmation(sessionId, "email_draft_saved");
      setCompleted(true);
      onUpdated?.();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save email draft");
    } finally {
      setPending(confirmKey, false);
    }
  }

  return (
    <ChatToolCardShell
      maxWidth="2xl"
      title={review.subject}
      description="Review and edit the evidence email before saving."
      error={error}
      footer={
        <>
          <Button variant="outline" onClick={() => setEditing((value) => !value)} disabled={confirming}>
            {editing ? "Preview" : "Edit"}
          </Button>
          <Button onClick={() => void handleSave()} disabled={confirming}>
            {confirming ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save draft"
            )}
          </Button>
        </>
      }
    >
      {editing ? (
        <Textarea
          value={bodyToRender}
          rows={12}
          disabled={confirming}
          onChange={(event) => {
            const next = { ...review, edited_body: event.target.value };
            setReview(next);
            void persist(next);
          }}
        />
      ) : (
        <div className="max-h-72 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">
          {bodyToRender}
        </div>
      )}

      {review.supporting_quotes.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Supporting quotes</p>
          {review.supporting_quotes.map((quote) => (
            <blockquote key={quote.id} className="border-l-2 pl-3 text-sm text-muted-foreground">
              {quote.text}
            </blockquote>
          ))}
        </div>
      ) : null}
    </ChatToolCardShell>
  );
}
