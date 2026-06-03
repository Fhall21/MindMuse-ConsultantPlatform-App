"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CARD_DISMISSED_COPY } from "@/lib/chat/onboarding-copy";
import {
  readAskChoiceQuestions,
  formatChoiceAnswers,
  type AskChoiceQuestion,
} from "@/lib/chat/tools/ask-choice";
import { ChatToolCardShell } from "./chat-tool-card-shell";
import type { ChatCardProps } from "./types";

export function AskChoiceCard({
  tool,
  messageId,
  sessionId,
  onUpdated,
  onSubmitText,
}: ChatCardProps) {
  const questions = readAskChoiceQuestions(tool.output);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, string[]>>(() => new Map());
  const [otherValues, setOtherValues] = useState<Map<string, string>>(() => new Map());
  const [otherOpen, setOtherOpen] = useState<Map<string, boolean>>(() => new Map());
  const [submitting, setSubmitting] = useState(false);

  const status = tool.status ?? "pending";
  const toolResultId = tool.toolResultId;

  // suppress unused-variable lint — messageId is passed via ChatCardProps
  void messageId;

  if (!questions) return null;
  const qs = questions; // narrowed: AskChoiceQuestion[]

  if (status === "success") {
    return (
      <ChatToolCardShell
        success
        title="Response submitted"
        description="Your answers were added to the conversation."
      />
    );
  }

  if (status === "dismissed") {
    return (
      <ChatToolCardShell
        dismissed
        title="Questions dismissed"
        description={CARD_DISMISSED_COPY}
      />
    );
  }

  const current = qs[currentIndex];
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === qs.length - 1;
  const total = qs.length;

  function selectedFor(q: AskChoiceQuestion): string[] {
    return answers.get(q.id) ?? [];
  }

  function hasAnswerFor(q: AskChoiceQuestion): boolean {
    return selectedFor(q).length > 0 || (otherValues.get(q.id)?.trim() ?? "").length > 0;
  }

  function allAnswered(): boolean {
    return qs.every((q) => hasAnswerFor(q));
  }

  function toggleOption(qId: string, option: string, mode: "single" | "multi") {
    setAnswers((prev) => {
      const next = new Map(prev);
      if (mode === "single") {
        next.set(qId, [option]);
      } else {
        const curr = next.get(qId) ?? [];
        next.set(
          qId,
          curr.includes(option) ? curr.filter((o) => o !== option) : [...curr, option]
        );
      }
      return next;
    });
    if (mode === "single") {
      setOtherOpen((prev) => { const n = new Map(prev); n.set(qId, false); return n; });
      setOtherValues((prev) => { const n = new Map(prev); n.delete(qId); return n; });
    }
  }

  function toggleOther(qId: string, mode: "single" | "multi") {
    const isNowOpen = !(otherOpen.get(qId) ?? false);
    setOtherOpen((prev) => { const n = new Map(prev); n.set(qId, isNowOpen); return n; });
    if (!isNowOpen) {
      setOtherValues((prev) => { const n = new Map(prev); n.delete(qId); return n; });
    }
    if (isNowOpen && mode === "single") {
      setAnswers((prev) => { const n = new Map(prev); n.set(qId, []); return n; });
    }
  }

  async function handleSubmit() {
    if (!allAnswered() || !sessionId) return;
    setSubmitting(true);
    try {
      const finalAnswers = new Map(answers);
      for (const q of qs) {
        const otherText = otherValues.get(q.id)?.trim();
        if (otherText) {
          finalAnswers.set(q.id, [...(finalAnswers.get(q.id) ?? []), otherText]);
        }
      }
      const text = formatChoiceAnswers(qs, finalAnswers);

      if (toolResultId) {
        await fetch(`/api/chat/tool-results/${toolResultId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, status: "success" }),
        });
      }

      onUpdated?.();
      await onSubmitText?.(text);
    } finally {
      setSubmitting(false);
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

  const isOtherOpen = otherOpen.get(current.id) ?? false;

  return (
    <ChatToolCardShell
      maxWidth="2xl"
      title={total > 1 ? `Question ${currentIndex + 1} of ${total}` : "Quick question"}
      description={current.question}
    >
      <div className="flex flex-wrap gap-2 pt-1">
        {current.options.map((option) => {
          const isSelected = selectedFor(current).includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => toggleOption(current.id, option, current.mode)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                isSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:bg-muted"
              )}
            >
              {current.mode === "multi" && (
                <span
                  className={cn(
                    "size-3 shrink-0 rounded-sm border",
                    isSelected ? "border-primary-foreground bg-primary-foreground/20" : "border-muted-foreground"
                  )}
                />
              )}
              {option}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => toggleOther(current.id, current.mode)}
          className={cn(
            "rounded-full border px-3 py-1.5 text-sm transition-colors",
            isOtherOpen
              ? "border-primary bg-primary text-primary-foreground"
              : "border-dashed border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          Other…
        </button>
      </div>

      {isOtherOpen && (
        <Input
          autoFocus
          placeholder="Type your answer…"
          value={otherValues.get(current.id) ?? ""}
          onChange={(e) => {
            const val = e.target.value;
            setOtherValues((prev) => {
              const next = new Map(prev);
              next.set(current.id, val);
              return next;
            });
          }}
          className="mt-3"
        />
      )}

      <div className="mt-4 flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={handleDismiss}
          disabled={submitting}
        >
          Dismiss
        </Button>

        <div className="flex gap-2">
          {!isFirst && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCurrentIndex((i) => i - 1)}
              disabled={submitting}
            >
              <ChevronLeft className="mr-1 size-3.5" />
              Back
            </Button>
          )}

          {isLast ? (
            <Button
              type="button"
              size="sm"
              disabled={!allAnswered() || submitting}
              onClick={handleSubmit}
            >
              {submitting ? "Sending…" : "Submit"}
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              disabled={!hasAnswerFor(current)}
              onClick={() => setCurrentIndex((i) => i + 1)}
            >
              Next
              <ChevronRight className="ml-1 size-3.5" />
            </Button>
          )}
        </div>
      </div>
    </ChatToolCardShell>
  );
}
