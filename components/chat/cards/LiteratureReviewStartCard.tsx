"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCardConfirm } from "@/components/chat/card-confirm-context";
import { readLiteratureReviewProposal } from "@/lib/chat/tools/literature-review";
import { ChatToolCardShell } from "./chat-tool-card-shell";
import type { ChatCardProps } from "./types";

export function LiteratureReviewStartCard({ tool, sessionId, onUpdated }: ChatCardProps) {
  const proposal = useMemo(() => readLiteratureReviewProposal(tool.output), [tool.output]);
  const [query, setQuery] = useState(proposal?.query ?? "");
  const [industryCtx, setIndustryCtx] = useState(proposal?.industry_ctx ?? "");
  const [researchSessionId, setResearchSessionId] = useState(
    proposal?.research_session_id
  );
  const [error, setError] = useState<string | null>(null);
  const { isPending, setPending } = useCardConfirm();
  const confirmKey = `literature-review:${tool.toolResultId ?? "unknown"}`;
  const confirming = isPending(confirmKey);

  if (!proposal) return null;

  if (researchSessionId || proposal.research_session_id || tool.status === "success") {
    const id = researchSessionId ?? proposal.research_session_id;
    return (
      <ChatToolCardShell
        success
        title="Literature review started"
        description="Your refined question is queued for research."
        successHelp={
          id ? (
            <Link href={`/research/${id}`} className="font-medium underline underline-offset-4">
              Open literature review
            </Link>
          ) : null
        }
      />
    );
  }

  async function handleConfirm() {
    if (!sessionId || !tool.toolResultId || query.trim().length < 10) return;
    setPending(confirmKey, true);
    setError(null);
    try {
      const response = await fetch("/api/chat/literature-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          toolResultId: tool.toolResultId,
          query,
          industry_ctx: industryCtx || undefined,
        }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(data?.detail ?? "Could not start literature review");
      }
      const data = (await response.json()) as { id: string };
      setResearchSessionId(data.id);
      onUpdated?.();
    } catch (confirmError) {
      setError(
        confirmError instanceof Error
          ? confirmError.message
          : "Could not start literature review"
      );
    } finally {
      setPending(confirmKey, false);
    }
  }

  return (
    <ChatToolCardShell
      title="Start literature review"
      description="Review the question before starting the research job."
      error={error}
      footer={
        <Button
          size="sm"
          onClick={() => void handleConfirm()}
          disabled={confirming || query.trim().length < 10}
        >
          {confirming ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Start literature review
        </Button>
      }
    >
      <div className="space-y-3">
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">Research question</span>
          <Textarea value={query} onChange={(event) => setQuery(event.target.value)} rows={4} />
        </label>
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">Industry context (optional)</span>
          <Input
            value={industryCtx}
            onChange={(event) => setIndustryCtx(event.target.value)}
            placeholder="e.g. healthcare, professional services"
          />
        </label>
      </div>
    </ChatToolCardShell>
  );
}
