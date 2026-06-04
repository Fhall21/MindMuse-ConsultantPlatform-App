"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCardConfirm } from "@/components/chat/card-confirm-context";
import { useAIPreferences, useUpdateAIPreferences } from "@/hooks/use-ai-preferences";
import { getCardSuccessShellProps } from "@/lib/chat/card-success-destinations";
import { buildEvidenceEmailGuidancePrefill } from "@/lib/chat/email-guidance-prefill";
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
  const aiPreferencesQuery = useAIPreferences();
  const updateAIPreferences = useUpdateAIPreferences();
  const confirmKey = `email-draft:${messageId}`;

  const [review, setReview] = useState<EmailDraftReviewOutput | null>(initialReview);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [emailGuidance, setEmailGuidance] = useState("");

  const status = tool.status ?? "pending";
  const toolResultId = tool.toolResultId;
  const confirming = isPending(confirmKey);

  useEffect(() => {
    if (initialReview) setReview(initialReview);
  }, [initialReview]);

  useEffect(() => {
    const request = initialReview?.revision_request?.trim() ?? "";
    setEmailGuidance(
      request
        ? buildEvidenceEmailGuidancePrefill(request)
        : aiPreferencesQuery.data?.emailGuidance || ""
    );
  }, [aiPreferencesQuery.data?.emailGuidance, initialReview]);

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
          revision_request: next.revision_request,
          supporting_quotes: next.supporting_quotes,
          linked_themes: next.linked_themes,
        }),
      });
    },
    [sessionId, toolResultId]
  );

  if (!review) return null;

  const bodyToRender = review.edited_body ?? review.body;
  const savedEmailGuidance = aiPreferencesQuery.data?.emailGuidance?.trim() ?? "";
  const emailGuidanceDirty = emailGuidance !== savedEmailGuidance;
  const showGuidance = Boolean(review.revision_request?.trim());

  function handleSaveGuidance() {
    const prefs = aiPreferencesQuery.data;
    if (!prefs || !emailGuidanceDirty) return;
    updateAIPreferences.mutate(
      {
        consultationTypes: prefs.consultationTypes ?? [],
        focusAreas: prefs.focusAreas ?? [],
        industry: prefs.industry ?? "",
        excludedTopics: prefs.excludedTopics ?? [],
        emailGuidance,
        anonymousMode: prefs.anonymousMode ?? true,
      },
      {
        onError: (guidanceError) =>
          setError(guidanceError instanceof Error ? guidanceError.message : "Could not save guidance"),
      }
    );
  }

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

  if (showGuidance) {
    return (
      <ChatToolCardShell
        maxWidth="2xl"
        title="Evidence email guidance"
        description="Review the edit instruction before saving it to AI preferences."
        error={error}
      >
        <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
          <div className="space-y-2">
            <p className="text-sm font-medium">Evidence email guidance</p>
            <p className="text-sm text-muted-foreground">
              Add one short note about how generated evidence emails should read.
              Use this for output shape, tone, or level of directness.
            </p>
          </div>
          <Textarea
            className="mt-3 min-h-24"
            maxLength={600}
            placeholder="e.g., Keep emails brief, lead with actions, and avoid repeating transcript wording."
            value={emailGuidance}
            onChange={(event) => setEmailGuidance(event.target.value)}
            disabled={aiPreferencesQuery.isPending || updateAIPreferences.isPending}
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">{emailGuidance.length}/600 used</p>
            <div className="flex items-center gap-3">
              <Link
                href="/settings/ai-personalisation"
                className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Open settings
              </Link>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSaveGuidance}
                disabled={
                  !emailGuidanceDirty ||
                  aiPreferencesQuery.isPending ||
                  updateAIPreferences.isPending
                }
              >
                {updateAIPreferences.isPending ? "Saving..." : "Save guidance"}
              </Button>
            </div>
          </div>
        </div>
      </ChatToolCardShell>
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
      }
    >
      <div className="max-h-72 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">
        {bodyToRender}
      </div>
    </ChatToolCardShell>
  );
}
