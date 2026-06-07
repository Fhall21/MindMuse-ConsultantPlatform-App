"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  useColumnSuggestions,
  type ColumnSuggestion,
} from "@/hooks/use-column-suggestions";
import { cn } from "@/lib/utils";

const STARTER_TEMPLATES = [
  {
    label: "What emotional burdens did participants describe?",
    category: "psychosocial",
  },
  {
    label: "What resilience or coping strategies emerged?",
    category: "psychosocial",
  },
  {
    label: "What systemic or structural barriers were identified?",
    category: "psychosocial",
  },
  {
    label: "How did participants describe their support networks?",
    category: "psychosocial",
  },
  {
    label: "What did participants need most? (Needs)",
    category: "design-thinking",
  },
  {
    label: "What caused the most frustration or difficulty? (Pains)",
    category: "design-thinking",
  },
  {
    label: "What positive outcomes or improvements would they value? (Gains)",
    category: "design-thinking",
  },
  {
    label: "What themes came up across multiple participants?",
    category: "universal",
  },
] as const;

export interface ColumnAddPanelProps {
  roundId: string;
  onAddColumn: (question: string) => void | Promise<void>;
  onCancel: () => void;
  prefetchSuggestions?: boolean;
  submitDisabled?: boolean;
}

function SuggestionRow({
  label,
  onSelect,
}: {
  label: string;
  onSelect: (value: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(label)}
      className={cn(
        "w-full rounded-md border border-border bg-background px-3 py-2 text-left text-xs leading-5",
        "text-muted-foreground transition-colors hover:border-border/80 hover:bg-muted/40 hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      {label}
    </button>
  );
}

function AiSuggestedQuestions({
  suggestions,
  isLoading,
  isError,
  onSelect,
}: {
  suggestions: ColumnSuggestion[];
  isLoading: boolean;
  isError?: boolean;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="grid gap-2.5 border-t pt-4">
      <p className="text-sm font-medium">AI-suggested for this project</p>
      {isLoading ? (
        <div
          className="flex items-center gap-2 text-xs text-muted-foreground"
          aria-live="polite"
          aria-busy="true"
        >
          <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
          Finding questions from your transcripts…
        </div>
      ) : isError ? (
        <p className="text-xs leading-5 text-muted-foreground">
          Could not load AI suggestions. Add your own question above.
        </p>
      ) : suggestions.length > 0 ? (
        <div className="grid gap-2">
          {suggestions.map((suggestion, index) => (
            <SuggestionRow
              key={`ai-suggestion-${index}`}
              label={suggestion.question}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs leading-5 text-muted-foreground">
          No AI suggestions yet. Add your own question above.
        </p>
      )}
    </div>
  );
}

export function ColumnAddPanel({
  roundId,
  onAddColumn,
  onCancel,
  prefetchSuggestions = true,
  submitDisabled = false,
}: ColumnAddPanelProps) {
  const [question, setQuestion] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    suggestions,
    isLoadingSuggestions,
    isError: suggestionsError,
  } = useColumnSuggestions(roundId, prefetchSuggestions);

  function resetForm() {
    setQuestion("");
    setSubmitError(null);
    setIsSubmitting(false);
  }

  function handleCancel() {
    resetForm();
    onCancel();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onAddColumn(trimmedQuestion);
      resetForm();
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Could not add question. Try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Add analysis question</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Add a question to compare across every meeting in this consultation.
        </p>
      </div>

      <ScrollArea className="flex-1">
        <form
          id="grid-column-add-form"
          className="grid gap-5 p-4"
          onSubmit={handleSubmit}
        >
          <div className="grid gap-2">
            <label htmlFor="grid-column-question" className="text-sm font-medium">
              Question
            </label>
            <Textarea
              id="grid-column-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="What are participants' main emotional burdens?"
              rows={3}
              autoFocus
            />
          </div>

          <div className="grid gap-2.5">
            <p className="text-sm font-medium">Starter questions</p>
            <div className="grid gap-2">
              {STARTER_TEMPLATES.map((template, index) => (
                <SuggestionRow
                  key={`starter-${template.category}-${index}`}
                  label={template.label}
                  onSelect={setQuestion}
                />
              ))}
            </div>
          </div>

          <AiSuggestedQuestions
            suggestions={suggestions}
            isLoading={isLoadingSuggestions}
            isError={suggestionsError}
            onSelect={setQuestion}
          />

          {submitError ? (
            <p className="text-sm text-destructive" role="alert">
              {submitError}
            </p>
          ) : null}
        </form>
      </ScrollArea>

      <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
        <Button type="button" variant="outline" onClick={handleCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          form="grid-column-add-form"
          disabled={!question.trim() || isSubmitting || submitDisabled}
        >
          {isSubmitting ? "Adding…" : "Add question →"}
        </Button>
      </div>
    </div>
  );
}
