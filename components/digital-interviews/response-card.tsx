"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDigitalInterviewTranscript } from "@/hooks/use-digital-interview-themes";
import type { DigitalInterviewResponseSummary } from "@/lib/data/digital-interviews";

function formatDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface ResponseCardProps {
  flowId: string;
  response: DigitalInterviewResponseSummary;
}

export function ResponseCard({ flowId, response }: ResponseCardProps) {
  const [expanded, setExpanded] = useState(false);

  const { data: full, isPending } = useDigitalInterviewTranscript(
    flowId,
    expanded ? response.id : null
  );

  const intervieweeName = response.interviewee_name ?? "Unknown respondent";
  const subtitle = [response.interviewee_role, response.interviewee_organisation]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="rounded-lg border border-border/70 bg-card">
      <div className="flex items-start justify-between gap-4 p-4">
        <div className="space-y-0.5">
          <p className="font-medium">{intervieweeName}</p>
          {subtitle ? (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
          {response.completed_at ? (
            <p className="text-xs text-muted-foreground">
              Completed {formatDate(response.completed_at)}
            </p>
          ) : null}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          <span className="sr-only">{expanded ? "Collapse" : "Expand"} transcript</span>
        </Button>
      </div>

      {expanded ? (
        <div className="border-t border-border/50 px-4 pb-4 pt-3">
          {isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          ) : full ? (
            <div className="space-y-3">
              {full.conversation_history.map((turn, i) => (
                <div
                  key={i}
                  className={
                    turn.role === "assistant"
                      ? "space-y-0.5"
                      : "rounded-md bg-muted/40 px-3 py-2 space-y-0.5"
                  }
                >
                  <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                    {turn.role === "assistant" ? "Interviewer" : "Respondent"}
                  </p>
                  <p className="text-sm">{turn.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-destructive">Failed to load transcript.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
