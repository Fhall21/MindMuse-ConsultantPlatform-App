"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAILearnings } from "@/hooks/use-ai-learnings";
import { cn } from "@/lib/utils";
import type { AIInsightLearning, AILearningType } from "@/types/db";

const MIN_SIGNALS_FOR_LEARNING_ANALYSIS = 5;

const LEARNING_TYPE_META: Record<
  AILearningType,
  {
    title: string;
    summary: string;
    icon: typeof Target;
    accent: string;
    iconTint: string;
    badgeTint: string;
  }
> = {
  process_pattern: {
    title: "Process patterns",
    summary: "Repeated habits in the kinds of insight structures you keep.",
    icon: Target,
    accent: "border-sky-200 bg-sky-50/80",
    iconTint: "bg-sky-100 text-sky-700",
    badgeTint: "border-sky-200 bg-white text-sky-700",
  },
  trend: {
    title: "Accepted trends",
    summary: "Topics and labels that are landing reliably over time.",
    icon: TrendingUp,
    accent: "border-emerald-200 bg-emerald-50/80",
    iconTint: "bg-emerald-100 text-emerald-700",
    badgeTint: "border-emerald-200 bg-white text-emerald-700",
  },
  rejection_signal: {
    title: "Rejection signals",
    summary: "Patterns the system should avoid or sharpen before surfacing.",
    icon: AlertTriangle,
    accent: "border-amber-200 bg-amber-50/85",
    iconTint: "bg-amber-100 text-amber-700",
    badgeTint: "border-amber-200 bg-white text-amber-700",
  },
  preference_alignment: {
    title: "Preference alignment",
    summary: "Where your explicit preferences are already reinforced by outcomes.",
    icon: CheckCircle2,
    accent: "border-fuchsia-200 bg-fuchsia-50/80",
    iconTint: "bg-fuchsia-100 text-fuchsia-700",
    badgeTint: "border-fuchsia-200 bg-white text-fuchsia-700",
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
    <Card>
      <CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <CardTitle>AI-generated learnings</CardTitle>
          <CardDescription>
            Durable patterns extracted from your accepted, rejected, and custom
            insights. These cards explain what the system is learning about your
            judgment.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{signalCount} signals reviewed</Badge>
          <Badge variant="outline">{learnings.length} learnings active</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? <LearningSummaryLoading /> : null}
        {!isLoading && error ? (
          <EmptyState
            icon={AlertTriangle}
            title="Could not load learnings"
            description={error.message || "Please try again in a moment."}
          />
        ) : null}
        {!isLoading && !error && learnings.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title={
              signalCount >= MIN_SIGNALS_FOR_LEARNING_ANALYSIS
                ? "Analysis is catching up"
                : "Keep reviewing insights"
            }
            description={
              signalCount >= MIN_SIGNALS_FOR_LEARNING_ANALYSIS
                ? "You have enough decisions for learning analysis. Fresh patterns will appear here once the background job finishes processing them."
                : `You need at least ${MIN_SIGNALS_FOR_LEARNING_ANALYSIS} reviewed insights before the system can extract stable personalisation learnings.`
            }
          />
        ) : null}
        {!isLoading && !error && learnings.length > 0 ? (
          <div className="space-y-5">
            {LEARNING_TYPE_ORDER.map((learningType) => {
              const items = learnings.filter(
                (learning) => learning.learning_type === learningType
              );

              if (items.length === 0) {
                return null;
              }

              const meta = LEARNING_TYPE_META[learningType];
              return (
                <section key={learningType} className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        {meta.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {meta.summary}
                      </p>
                    </div>
                    <Badge className={cn("border", meta.badgeTint)}>
                      {items.length}
                    </Badge>
                  </div>
                  <div className="grid gap-3 xl:grid-cols-2">
                    {items.map((learning) => (
                      <LearningCard
                        key={learning.id}
                        learning={learning}
                        meta={meta}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function LearningCard({
  learning,
  meta,
}: {
  learning: AIInsightLearning;
  meta: (typeof LEARNING_TYPE_META)[AILearningType];
}) {
  const Icon = meta.icon;
  const stats = buildStats(learning);

  return (
    <article
      className={cn(
        "rounded-xl border p-4 shadow-sm transition-colors",
        meta.accent
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
            meta.iconTint
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              {learning.label}
            </p>
            <p className="text-sm leading-6 text-slate-700">
              {learning.description}
            </p>
          </div>
          {stats.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {stats.map((stat) => (
                <Badge key={stat} variant="secondary" className="bg-white/80">
                  {stat}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function LearningSummaryLoading() {
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="rounded-xl border p-4">
          <div className="flex items-start gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-3">
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-6 w-28 rounded-full" />
              </div>
            </div>
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
    <div className="rounded-xl border border-dashed bg-muted/30 p-6 text-center">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-background shadow-sm">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function buildStats(learning: AIInsightLearning) {
  const metrics = learning.supporting_metrics;
  const stats: string[] = [];

  if (typeof metrics.confidence_score === "number") {
    stats.push(`Confidence ${Math.round(metrics.confidence_score * 100)}%`);
  }

  if (typeof metrics.accepted_count === "number") {
    stats.push(`${metrics.accepted_count} accepted`);
  }

  if (typeof metrics.rejection_count === "number") {
    stats.push(`${metrics.rejection_count} rejected`);
  }

  if (typeof metrics.alignment_count === "number") {
    stats.push(`${metrics.alignment_count} matches found`);
  }

  if (typeof metrics.percentage === "number") {
    stats.push(`${Math.round(metrics.percentage * 100)}% share`);
  }

  if (Array.isArray(metrics.preference_labels) && metrics.preference_labels.length) {
    stats.push(metrics.preference_labels.slice(0, 2).join(" • "));
  }

  if (
    metrics.rejection_reasons &&
    typeof metrics.rejection_reasons === "object" &&
    !Array.isArray(metrics.rejection_reasons)
  ) {
    const topReasons = Object.entries(metrics.rejection_reasons)
      .sort((left, right) => Number(right[1]) - Number(left[1]))
      .slice(0, 2)
      .map(([reason]) => reason);

    if (topReasons.length > 0) {
      stats.push(`Often rejected for ${topReasons.join(" and ")}`);
    }
  }

  return stats;
}
