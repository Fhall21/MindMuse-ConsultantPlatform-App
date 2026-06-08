"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, LayoutGrid, LoaderCircle, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { STARTER_TEMPLATES, SuggestionRow } from "@/lib/grid-starter-templates";

const MAX_QUESTIONS = 10;

export interface EmptyGridBuilderProps {
  roundId: string;
  onGenerate: (questions: string[]) => Promise<void>;
}

export function EmptyGridBuilder({ onGenerate }: EmptyGridBuilderProps) {
  const [draft, setDraft] = useState("");
  const [queue, setQueue] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [startersOpen, setStartersOpen] = useState(false);
  const [flashIndex, setFlashIndex] = useState<number | null>(null);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    };
  }, []);

  const addToQueue = useCallback(() => {
    const trimmed = draft.trim();
    if (!trimmed) return;

    const dupeIndex = queue.indexOf(trimmed);
    if (dupeIndex !== -1) {
      setFlashIndex(dupeIndex);
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = setTimeout(() => setFlashIndex(null), 600);
      return;
    }

    if (queue.length >= MAX_QUESTIONS) return;

    setQueue((prev) => [...prev, trimmed]);
    setDraft("");
  }, [draft, queue]);

  function removeFromQueue(index: number) {
    setQueue((prev) => prev.filter((_, i) => i !== index));
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      addToQueue();
    }
  }

  async function handleGenerate() {
    const trimmedDraft = draft.trim();
    let finalQueue = [...queue];

    if (trimmedDraft) {
      const isDupe = finalQueue.includes(trimmedDraft);
      if (!isDupe && finalQueue.length < MAX_QUESTIONS) {
        finalQueue = [...finalQueue, trimmedDraft];
      }
    }

    if (finalQueue.length === 0) return;

    setIsGenerating(true);
    try {
      await onGenerate(finalQueue);
    } finally {
      setIsGenerating(false);
    }
  }

  const atMax = queue.length >= MAX_QUESTIONS;
  const generateCount = queue.length;
  const generateLabel =
    generateCount === 1 ? "Generate 1 question" : `Generate ${generateCount} questions`;

  return (
    <div className="flex flex-1 items-start justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-6">
          <div className="mb-3 flex size-8 items-center justify-center rounded-md border bg-muted/40">
            <LayoutGrid className="size-4 text-muted-foreground" aria-hidden="true" />
          </div>
          <h2 className="text-base font-semibold">Start your analysis</h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            Add the questions you want answered across every meeting in this consultation.
          </p>
        </div>

        <div className="grid gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What are participants' main emotional burdens?"
            rows={3}
            disabled={isGenerating}
            autoFocus
            aria-label="Question to add"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {atMax ? null : "Cmd+Enter to add"}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addToQueue}
              disabled={!draft.trim() || atMax || isGenerating}
              title={atMax ? "Maximum 10 questions" : undefined}
              className="min-h-[44px]"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Add question
            </Button>
          </div>
        </div>

        {queue.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Queue ({queue.length})
            </p>
            <ul role="list" aria-live="polite" className="grid gap-1.5">
              {queue.map((question, index) => (
                <li
                  key={`${index}-${question}`}
                  className={cn(
                    "flex min-h-[44px] items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm transition-colors duration-150",
                    flashIndex === index && "border-foreground ring-1 ring-foreground/20"
                  )}
                >
                  <span
                    className="size-1.5 shrink-0 rounded-full bg-muted-foreground/50"
                    aria-hidden="true"
                  />
                  <span className="flex-1 leading-5">{question}</span>
                  <button
                    type="button"
                    onClick={() => removeFromQueue(index)}
                    disabled={isGenerating}
                    className="ml-1 flex size-[44px] shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
                    aria-label={`Remove: ${question}`}
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5">
          <Button
            type="button"
            onClick={handleGenerate}
            disabled={generateCount === 0 || isGenerating}
            aria-label={generateLabel}
            className="w-full min-h-[44px]"
          >
            {isGenerating ? (
              <>
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                Generating…
              </>
            ) : (
              `${generateLabel} →`
            )}
          </Button>
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={() => setStartersOpen((prev) => !prev)}
            className="flex w-full items-center gap-1.5 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-expanded={startersOpen}
          >
            <ChevronDown
              className={cn(
                "size-3.5 transition-transform duration-150",
                startersOpen && "rotate-180"
              )}
              aria-hidden="true"
            />
            Or pick a starter question
          </button>

          {startersOpen && (
            <div className="mt-2 grid gap-2">
              {STARTER_TEMPLATES.map((template, index) => (
                <SuggestionRow
                  key={`starter-${template.category}-${index}`}
                  label={template.label}
                  onSelect={(value) => {
                    setDraft(value);
                    setStartersOpen(false);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
