"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatToolCardShell } from "./chat-tool-card-shell";
import type { ChatCardProps } from "./types";

export function AnalyzeStartCard({ tool }: ChatCardProps) {
  const output = tool.output as Record<string, unknown> | null;
  const consultationId =
    typeof output?.consultation_id === "string" ? output.consultation_id : null;
  const error = typeof output?.error === "string" ? output.error : null;

  if (error) {
    return (
      <ChatToolCardShell
        title="Cross-transcript analysis"
        description={error}
      />
    );
  }

  return (
    <ChatToolCardShell
      title="Cross-transcript analysis"
      description="Analysis queued — you'll see a notification in the bell when it's done."
      footer={
        consultationId ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`/canvas/round/${consultationId}?tab=analysis`}>
              Open analysis tab
              <ExternalLink className="size-4" />
            </Link>
          </Button>
        ) : undefined
      }
    />
  );
}
