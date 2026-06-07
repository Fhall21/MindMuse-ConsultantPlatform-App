"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { readAnalysisJobSummaryList } from "@/lib/chat/tools/analysis";
import { ChatToolCardShell } from "./chat-tool-card-shell";
import type { ChatCardProps } from "./types";

export function PreviousAnalysesCard({ tool, sessionId }: ChatCardProps) {
  const [running, setRunning] = useState(false);
  const output = tool.output as Record<string, unknown> | null;
  const consultationId =
    typeof output?.consultation_id === "string" ? output.consultation_id : null;
  const analyses = readAnalysisJobSummaryList(output?.analyses);

  async function handleRunNew() {
    if (!consultationId) return;
    setRunning(true);
    try {
      await fetch("/api/analysis/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consultation_id: consultationId,
          ...(sessionId ? { session_id: sessionId } : {}),
        }),
        credentials: "include",
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <ChatToolCardShell
      title="Previous analyses"
      description="Statistical analysis via hdbscan clustering. Not AI-generated."
    >
      {analyses.length === 0 ? (
        <p className="text-sm text-muted-foreground">No analyses run yet for this consultation.</p>
      ) : (
        <ul className="space-y-2">
          {analyses.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
            >
              <span className="text-muted-foreground">
                {new Date(a.created_at).toLocaleDateString()} —{" "}
                <span className="font-medium text-foreground">
                  {a.pattern_count} pattern{a.pattern_count !== 1 ? "s" : ""}
                </span>
                , {a.transcript_count} transcript{a.transcript_count !== 1 ? "s" : ""}
              </span>
              {consultationId ? (
                <Link
                  href={`/canvas/round/${consultationId}?tab=analysis`}
                  className="shrink-0 text-xs text-primary underline-offset-2 hover:underline"
                >
                  View
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void handleRunNew()}
          disabled={running || !consultationId}
        >
          {running ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
          Run new analysis
        </Button>
      </div>
    </ChatToolCardShell>
  );
}
