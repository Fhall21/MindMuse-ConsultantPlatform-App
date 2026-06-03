"use client";

import { useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CARD_DISMISSED_COPY } from "@/lib/chat/onboarding-copy";
import {
  readAskChoiceQuestions,
  readAskChoiceContext,
  formatChoiceAnswers,
  askChoiceCardTitle,
  type AskChoiceQuestion,
} from "@/lib/chat/tools/ask-choice";
import { ChatToolCardShell } from "./chat-tool-card-shell";
import type { ChatCardProps } from "./types";

export function AskChoiceCard({
  tool,
  sessionId,
  onUpdated,
  onSubmitText,
}: ChatCardProps) {
  const questions = readAskChoiceQuestions(tool.output);
  const choiceContext = readAskChoiceContext(tool.output);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Map<string, string[]>>(() => new Map());
  const [otherValues, setOtherValues] = useState<Map<string, string>>(() => new Map());
  const [otherOpen, setOtherOpen] = useState<Map<string, boolean>>(() => new Map());
  const [submitting, setSubmitting] = useState(false);

  const status = tool.status ?? "pending";
  const toolResultId = tool.toolResultId;

  if (!questions) return null;
  const qs = questions;

  if (status === "success") {
    return (
      <ChatToolCardShell
        success
        title="Response recorded"
        description="Your answer was added to the conversation."
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
    return (
      selectedFor(q).length > 0 ||
      (otherValues.get(q.id)?.trim() ?? "").length > 0
    );
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
      setOtherOpen((prev) => {
        const n = new Map(prev);
        n.set(qId, false);
        return n;
      });
      setOtherValues((prev) => {
        const n = new Map(prev);
        n.delete(qId);
        return n;
      });
    }
  }

  function toggleOther(qId: string, mode: "single" | "multi") {
    const isNowOpen = !(otherOpen.get(qId) ?? false);
    setOtherOpen((prev) => {
      const n = new Map(prev);
      n.set(qId, isNowOpen);
      return n;
    });
    if (!isNowOpen) {
      setOtherValues((prev) => {
        const n = new Map(prev);
        n.delete(qId);
        return n;
      });
    }
    if (isNowOpen && mode === "single") {
      setAnswers((prev) => {
        const n = new Map(prev);
        n.set(qId, []);
        return n;
      });
    }
  }

  async function handleSubmit() {
    if (!allAnswered() || !sessionId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const finalAnswers = new Map(answers);
      for (const q of qs) {
        const otherText = otherValues.get(q.id)?.trim();
        if (otherText) {
          finalAnswers.set(q.id, [...(finalAnswers.get(q.id) ?? []), otherText]);
        }
      }
      const text = formatChoiceAnswers(qs, finalAnswers, choiceContext);

      const sent = (await onSubmitText?.(text)) ?? false;
      if (!sent) {
        setSubmitError("MindMuse is still responding — wait a moment, then submit again.");
        return;
      }

      if (toolResultId) {
        const response = await fetch(`/api/chat/tool-results/${toolResultId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            status: "success",
            choice_reply_text: text,
          }),
        });
        if (!response.ok) {
          const json = (await response.json().catch(() => ({}))) as { detail?: string };
          throw new Error(json.detail ?? "Could not save your response");
        }
      }

      onUpdated?.();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not send your response");
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
  const selected = selectedFor(current);

  const baseTitle = askChoiceCardTitle(qs);
  const titleNode =
    total > 1 ? (
      <span className="flex items-baseline gap-2">
        <span>{baseTitle}</span>
        <span className="text-xs font-normal tracking-wide text-muted-foreground">
          {currentIndex + 1}&thinsp;/&thinsp;{total}
        </span>
      </span>
    ) : (
      baseTitle
    );

  return (
    <ChatToolCardShell
      maxWidth="2xl"
      title={titleNode}
      description={current.question}
      error={submitError}
      onDismiss={handleDismiss}
      dismissDisabled={submitting}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          {/* Progress dots — only shown when > 1 question */}
          {total > 1 ? (
            <div className="flex items-center gap-1.5" aria-hidden>
              {qs.map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "block rounded-full transition-all duration-200",
                    i === currentIndex
                      ? "h-1.5 w-4 bg-primary/50"
                      : i < currentIndex
                        ? "size-1.5 bg-primary/30"
                        : "size-1.5 bg-border"
                  )}
                />
              ))}
            </div>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCurrentIndex((i) => i - 1)}
                disabled={submitting}
              >
                <ChevronLeft className="mr-0.5 size-3.5" />
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
                <ChevronRight className="ml-0.5 size-3.5" />
              </Button>
            )}
          </div>
        </div>
      }
    >
      {choiceContext ? (
        <p className="text-xs text-muted-foreground">{choiceContext}</p>
      ) : null}

      {/* Mode label */}
      {current.mode === "multi" && (
        <p className="text-xs text-muted-foreground">Select all that apply.</p>
      )}

      {/* Options */}
      <div className="flex flex-wrap gap-2">
        {current.options.map((option) => {
          const isSelected = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => toggleOption(current.id, option, current.mode)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-sm transition-colors",
                isSelected
                  ? "border-primary/40 bg-primary/[0.07] font-medium text-primary hover:bg-primary/10"
                  : "border-border bg-background text-foreground hover:border-border/80 hover:bg-muted"
              )}
            >
              {current.mode === "multi" && (
                <span
                  className={cn(
                    "flex size-3.5 shrink-0 items-center justify-center rounded-sm border",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/40"
                  )}
                >
                  {isSelected && <Check className="size-2.5 stroke-[3]" />}
                </span>
              )}
              {option}
            </button>
          );
        })}

        {/* Other */}
        <button
          type="button"
          onClick={() => toggleOther(current.id, current.mode)}
          className={cn(
            "rounded border px-3 py-1.5 text-sm transition-colors",
            isOtherOpen
              ? "border-primary/40 bg-primary/[0.07] font-medium text-primary hover:bg-primary/10"
              : "border-dashed border-border/70 bg-background text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground"
          )}
        >
          Other…
        </button>
      </div>

      {/* Other text input */}
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
        />
      )}
    </ChatToolCardShell>
  );
}
