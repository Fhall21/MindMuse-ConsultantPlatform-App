"use client";

import { AlertTriangle, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAILearnings } from "@/hooks/use-ai-learnings";
import { cn } from "@/lib/utils";
import type { AIInsightLearning, AILearningType } from "@/types/db";

const MIN_SIGNALS_FOR_LEARNING_ANALYSIS = 5;

const LEARNING_TYPE_META: Record<
  AILearningType,
  { title: string; summary: string; dot: string }
> = {
  process_pattern: {
    title: "Process patterns",
    summary: "Repeated habits in the insight structures you keep",
    dot: "bg-sky-500",
  },
  trend: {
    title: "Accepted trends",
    summary: "Topics landing reliably across projects",
    dot: "bg-emerald-500",
  },
  rejection_signal: {
    title: "Rejection signals",
    summary: "Patterns to avoid or sharpen before surfacing",
    dot: "bg-amber-500",
  },
  preference_alignment: {
    title: "Preference alignment",
    summary: "Explicit preferences reinforced by outcomes",
    dot: "bg-violet-500",
  },
};

const LEARNING_TYPE_ORDER: AILearningType[] = [
  "process_pattern",
  "trend",
  "rejection_signal",
  "preference_alignment",
];

export function LearningSummary({ signalCount }: { signalCount: number }) {
  const { data, error, isLoading } = useAILearnings();
  const learnings = data?.learnings ?? [];

  return (
    <Card className="overflow-hidden border-border/60">
      {/* ── Section header ──────────────────────────────────── */}
      <div className="flex items-baseline justify-between gap-4 border-b border-border/50 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold">AI-generated learnings</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Durable patterns extracted from your accepted, rejected, and custom
            insights.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          <span>{signalCount} signals</span>
          {learnings.length > 0 && (
            <>
              <span className="opacity-40">·</span>
              <span className="font-medium text-foreground">
                {learnings.length} active
              </span>
            </>
          )}
        </div>
      </div>

      <CardContent className="p-0">
        {/* Loading */}
        {isLoading && <LearningSummaryLoading />}

        {/* Error */}
        {!isLoading && error && (
          <EmptyState
            icon={AlertTriangle}
            title="Could not load learnings"
            description={error.message || "Please try again in a moment."}
          />
        )}

        {/* Empty */}
        {!isLoading && !error && learnings.length === 0 && (
          <EmptyState
            icon={Sparkles}
            title={
              signalCount >= MIN_SIGNALS_FOR_LEARNING_ANALYSIS
                ? "Analysis is catching up"
                : "Keep reviewing insights"
            }
            description={
              signalCount >= MIN_SIGNALS_FOR_LEARNING_ANALYSIS
                ? "You have enough decisions for learning analysis. Fresh patterns will appear here once the background job finishes."
                : `Review at least ${MIN_SIGNALS_FOR_LEARNING_ANALYSIS} insights before the system can extract stable patterns.`
            }
          />
        )}

        {/* Learnings */}
        {!isLoading && !error && learnings.length > 0 && (
          <div className="divide-y divide-border/40">
            {LEARNING_TYPE_ORDER.map((learningType) => {
              const items = learnings.filter(
                (l) => l.learning_type === learningType
              );
              if (items.length === 0) return null;
              const meta = LEARNING_TYPE_META[learningType];

              return (
                <section key={learningType}>
                  {/* Category label */}
                  <div className="flex items-center gap-2 bg-muted/30 px-5 py-2.5">
                    <span
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        meta.dot
                      )}
                    />
                    <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {meta.title}
                    </span>
                    <span className="text-[11px] text-muted-foreground/50">
                      —
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {meta.summary}
                    </span>
                    <span className="ml-auto text-xs font-medium tabular-nums text-muted-foreground">
                      {items.length}
                    </span>
                  </div>

                  {/* Rows */}
                  <div className="divide-y divide-border/40">
                    {items.map((learning) => (
                      <LearningRow key={learning.id} learning={learning} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LearningRow({ learning }: { learning: AIInsightLearning }) {
  const metrics = learning.supporting_metrics;
  const confidence =
    typeof metrics.confidence_score === "number"
      ? Math.round(metrics.confidence_score * 100)
      : null;

  const chips: string[] = [];
  if (typeof metrics.accepted_count === "number")
    chips.push(`${metrics.accepted_count} accepted`);
  if (typeof metrics.rejection_count === "number")
    chips.push(`${metrics.rejection_count} rejected`);
  if (typeof metrics.alignment_count === "number")
    chips.push(`${metrics.alignment_count} matches`);
  if (typeof metrics.percentage === "number")
    chips.push(`${Math.round(metrics.percentage * 100)}% share`);
  if (
    Array.isArray(metrics.preference_labels) &&
    metrics.preference_labels.length
  ) {
    chips.push(metrics.preference_labels.slice(0, 2).join(" · "));
  }
  if (
    metrics.rejection_reasons &&
    typeof metrics.rejection_reasons === "object" &&
    !Array.isArray(metrics.rejection_reasons)
  ) {
    const topReasons = Object.entries(
      metrics.rejection_reasons as Record<string, number>
    )
      .sort(([, a], [, b]) => b - a)
      .slice(0, 2)
      .map(([r]) => r);
    if (topReasons.length > 0)
      chips.push(`Often rejected for ${topReasons.join(" and ")}`);
  }

  return (
    <div className="px-5 py-4">
      <p className="text-sm font-medium leading-snug">{learning.label}</p>
      <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted-foreground">
        {learning.description}
      </p>

      {(confidence !== null || chips.length > 0) && (
        <div className="mt-3 space-y-2">
          {confidence !== null && (
            <div className="flex items-center gap-3">
              <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full",
                    confidence >= 70
                      ? "bg-emerald-500"
                      : confidence >= 50
                        ? "bg-primary"
                        : "bg-amber-400"
                  )}
                  style={{ width: `${confidence}%` }}
                />
              </div>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {confidence}% confidence
              </span>
            </div>
          )}
          {chips.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {chips.join(" · ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function LearningSummaryLoading() {
  return (
    <div className="divide-y divide-border/40">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="px-5 py-4 space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-full max-w-sm" />
          <Skeleton className="h-3 w-4/5 max-w-xs" />
          <div className="flex items-center gap-3 pt-1">
            <Skeleton className="h-[3px] flex-1 rounded-full" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Sparkles;
  title: string;
  description: string;
}) {
  return (
    <div className="px-5 py-10 text-center">
      <Icon className="mx-auto mb-3 h-5 w-5 text-muted-foreground/50" />
      <p className="text-sm font-medium">{title}</p>
      <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
