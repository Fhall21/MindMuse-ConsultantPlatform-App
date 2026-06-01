"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCardConfirm } from "@/components/chat/card-confirm-context";
import {
  CARD_DISMISSED_COPY,
  CARD_REOPEN_HELP,
  REPORT_DRAFT_SAVED_COPY,
} from "@/lib/chat/onboarding-copy";
import { readReportDraftReviewOutput } from "@/lib/chat/tools/async-actions";
import { ChatToolCardShell } from "./chat-tool-card-shell";
import type { ChatCardProps } from "./types";

export function ReportPreviewCard({
  tool,
  messageId,
  sessionId,
  onUpdated,
}: ChatCardProps) {
  const initialReview = useMemo(() => readReportDraftReviewOutput(tool.output), [tool.output]);
  const { isPending, setPending } = useCardConfirm();
  const confirmKey = `report-draft:${messageId}`;

  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const review = initialReview;
  const status = tool.status ?? "pending";
  const toolResultId = tool.toolResultId;
  const confirming = isPending(confirmKey);

  if (!review) return null;

  if (status === "success" || completed) {
    return (
      <ChatToolCardShell
        success
        title="Report saved"
        description={REPORT_DRAFT_SAVED_COPY}
        successHelp={CARD_REOPEN_HELP}
      />
    );
  }

  if (status === "dismissed") {
    return (
      <ChatToolCardShell dismissed title="Report dismissed" description={CARD_DISMISSED_COPY} />
    );
  }

  async function handleSave() {
    if (!review || !sessionId || !toolResultId) return;
    setPending(confirmKey, true);
    setError(null);
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-chat-session-id": sessionId,
        },
        body: JSON.stringify({
          consultation_id: review.consultation_id,
          title: review.title,
          body: review.body,
          draft_id: review.draft_id,
          tool_result_id: toolResultId,
        }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(data?.detail ?? "Could not save report");
      }
      setCompleted(true);
      onUpdated?.();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save report");
    } finally {
      setPending(confirmKey, false);
    }
  }

  const reportHref = `/consultations/rounds/${review.consultation_id}?tab=reports`;

  return (
    <ChatToolCardShell
      maxWidth="2xl"
      title={review.title}
      description="Preview the generated report before saving."
      error={error}
      footer={
        <>
          <Button asChild variant="outline" size="sm">
            <Link href={reportHref}>
              Open full report
              <ExternalLink className="size-4" />
            </Link>
          </Button>
          <Button onClick={() => void handleSave()} disabled={confirming}>
            {confirming ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save report"
            )}
          </Button>
        </>
      }
    >
      <div className="max-h-72 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">
        {review.body.slice(0, 2500)}
      </div>
    </ChatToolCardShell>
  );
}
