"use client";

import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type {
  EnhanceClarificationQuestion,
  EnhancePriorAnswer,
  EnhanceQuestionResponse,
} from "@/hooks/use-research";
import { cn } from "@/lib/utils";

export interface EnhancementClarifierProps {
  payload: EnhanceQuestionResponse;
  originalQuery: string;
  disabled?: boolean;
  onSubmit: (answers: EnhancePriorAnswer[]) => void;
  onSkip: () => void;
}

function McqCard({
  question,
  value,
  onChange,
  disabled,
}: {
  question: EnhanceClarificationQuestion;
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const toggleMulti = (optionId: string, checked: boolean) => {
    if (checked) {
      onChange([...value, optionId]);
    } else {
      onChange(value.filter((id) => id !== optionId));
    }
  };

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div>
        <p className="text-sm font-medium text-foreground">{question.question}</p>
        {question.rationale && (
          <p className="mt-1 text-xs text-muted-foreground">{question.rationale}</p>
        )}
      </div>

      {question.allow_multiple ? (
        <div className="space-y-2">
          {question.options.map((opt) => {
            const checked = value.includes(opt.id);
            return (
              <label
                key={opt.id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                  checked ? "border-foreground/30 bg-muted/40" : "border-border/60",
                  disabled && "pointer-events-none opacity-60"
                )}
              >
                <Checkbox
                  checked={checked}
                  disabled={disabled}
                  onCheckedChange={(state) => toggleMulti(opt.id, state === true)}
                  className="mt-0.5"
                />
                <span className="text-sm leading-snug">{opt.label}</span>
              </label>
            );
          })}
        </div>
      ) : (
        <RadioGroup
          value={value[0] ?? ""}
          onValueChange={(id) => onChange(id ? [id] : [])}
          disabled={disabled}
          className="space-y-2"
        >
          {question.options.map((opt) => (
            <label
              key={opt.id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                value[0] === opt.id ? "border-foreground/30 bg-muted/40" : "border-border/60",
                disabled && "pointer-events-none opacity-60"
              )}
            >
              <RadioGroupItem value={opt.id} id={`${question.id}-${opt.id}`} className="mt-0.5" />
              <span className="text-sm leading-snug">{opt.label}</span>
            </label>
          ))}
        </RadioGroup>
      )}
    </div>
  );
}

export function EnhancementClarifier({
  payload,
  originalQuery,
  disabled,
  onSubmit,
  onSkip,
}: EnhancementClarifierProps) {
  const [answers, setAnswers] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(payload.questions.map((q) => [q.id, []]))
  );

  const allAnswered = useMemo(
    () => payload.questions.every((q) => (answers[q.id]?.length ?? 0) > 0),
    [answers, payload.questions]
  );

  const handleSubmit = useCallback(() => {
    const prior: EnhancePriorAnswer[] = payload.questions.map((q) => ({
      question_id: q.id,
      selected_option_ids: answers[q.id] ?? [],
    }));
    onSubmit(prior);
  }, [answers, onSubmit, payload.questions]);

  return (
    <div className="space-y-4">
      {payload.background && (
        <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Background
          </p>
          <p className="mt-1 text-sm text-foreground/90">{payload.background}</p>
        </div>
      )}

      {payload.suggested_models.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Suggested approaches
          </p>
          <div className="flex flex-wrap gap-2">
            {payload.suggested_models.map((model) => (
              <span
                key={model}
                className="inline-flex rounded-full border border-border/60 bg-muted/40 px-2.5 py-0.5 text-xs text-muted-foreground"
              >
                {model}
              </span>
            ))}
          </div>
        </div>
      )}

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer select-none hover:text-foreground">
          View original question
        </summary>
        <p className="mt-2 rounded-md border bg-muted/20 px-3 py-2 text-sm text-foreground/85">
          {originalQuery}
        </p>
      </details>

      <div className="space-y-3">
        {payload.questions.map((q) => (
          <McqCard
            key={q.id}
            question={q}
            value={answers[q.id] ?? []}
            disabled={disabled}
            onChange={(next) => setAnswers((prev) => ({ ...prev, [q.id]: next }))}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button
          size="sm"
          disabled={disabled || !allAnswered}
          onClick={() => handleSubmit()}
        >
          Refine and run
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={onSkip}
          className="text-muted-foreground"
        >
          Skip and use my question as-is
        </Button>
      </div>
    </div>
  );
}
