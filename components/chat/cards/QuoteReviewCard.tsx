"use client";

import { useMemo } from "react";
import { Quote } from "lucide-react";
import { QuoteReviewPanel } from "@/components/consultations/quote-review-panel";
import { readShowQuotesOutput } from "@/lib/chat/tools/quotes";
import { ChatToolCardShell } from "./chat-tool-card-shell";
import type { ChatCardProps } from "./types";

export function QuoteReviewCard({ tool }: ChatCardProps) {
  const data = useMemo(() => readShowQuotesOutput(tool.output), [tool.output]);

  if (tool.status === "error" || !data) {
    return (
      <ChatToolCardShell
        title={
          <span className="flex items-center gap-2">
            <Quote className="size-4" />
            Quotes
          </span>
        }
        error="Meeting not found or unavailable."
      />
    );
  }

  return (
    <ChatToolCardShell
      title={
        <span className="flex items-center gap-2">
          <Quote className="size-4" />
          {`Quotes — ${data.meeting_title}`}
        </span>
      }
      description="Highlight transcript text to capture a quote."
      maxWidth="5xl"
    >
      {/*
       * Contain scroll within the panel so text-selection gestures in the
       * transcript don't propagate to the chat column scroll container.
       */}
      <div
        className="max-h-[70vh] overflow-y-auto overscroll-contain"
        onPointerDownCapture={(e) => e.stopPropagation()}
      >
        <QuoteReviewPanel meetingId={data.meeting_id} />
      </div>
    </ChatToolCardShell>
  );
}
