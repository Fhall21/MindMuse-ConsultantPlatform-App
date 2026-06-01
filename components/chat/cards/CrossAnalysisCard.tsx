"use client";

import Link from "next/link";
import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CrossAnalysisResults } from "@/lib/chat/analysis-db";
import { ChatToolCardShell } from "./chat-tool-card-shell";

interface CrossAnalysisCardProps {
  results: CrossAnalysisResults;
  consultationId: string;
  onDismiss?: () => void;
}

export function CrossAnalysisCard({
  results,
  consultationId,
  onDismiss,
}: CrossAnalysisCardProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return null;
  }

  const canvasHref = `/canvas/round/${consultationId}?tab=canvas`;

  return (
    <ChatToolCardShell
      maxWidth="2xl"
      title="Cross-transcript analysis"
      description={`${results.pattern_count} emerging pattern${results.pattern_count === 1 ? "" : "s"} across ${results.transcript_count} transcripts.`}
      onDismiss={() => {
        setDismissed(true);
        onDismiss?.();
      }}
      footer={
        <Button asChild variant="outline" size="sm">
          <Link href={canvasHref}>
            Explore in canvas
            <ExternalLink className="size-4" />
          </Link>
        </Button>
      }
    >
      <ul className="space-y-2">
        {results.findings.map((finding) => (
          <li key={finding.id} className="rounded-md border px-3 py-2 text-sm">
            {finding.summary}
          </li>
        ))}
      </ul>
    </ChatToolCardShell>
  );
}
