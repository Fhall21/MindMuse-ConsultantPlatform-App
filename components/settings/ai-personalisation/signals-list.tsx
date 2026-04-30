"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Pencil, Trash2 } from "lucide-react";
import {
  useInsightSignals,
  useUpdateSignalRationale,
  useDeleteSignal,
} from "@/hooks/use-insight-signals";
import { toast } from "sonner";
import type { InsightDecisionLog, InsightDecisionType } from "@/types/db";

function safeFormatDate(str: string): string {
  const d = new Date(str);
  if (isNaN(d.getTime())) return null as unknown as string;
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(diffDays > 365 ? { year: "numeric" } : {}),
  });
}

const decisionConfig: Record<
  InsightDecisionType,
  { label: string; badgeClass: string; pillActive: string }
> = {
  accept: {
    label: "Accepted",
    badgeClass:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
    pillActive:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  reject: {
    label: "Rejected",
    badgeClass:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300",
    pillActive:
      "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  },
  user_added: {
    label: "Added by you",
    badgeClass:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300",
    pillActive:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  },
  restore: {
    label: "Restored",
    badgeClass:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300",
    pillActive:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  },
};

type FilterType = "all" | InsightDecisionType;

function SignalItem({ signal }: { signal: InsightDecisionLog }) {
  const [editOpen, setEditOpen] = useState(false);
  const [rationale, setRationale] = useState(signal.rationale ?? "");
  const { mutate: updateRationale, isPending: isUpdating } =
    useUpdateSignalRationale();
  const { mutate: deleteSignal, isPending: isDeleting } = useDeleteSignal();

  const config =
    decisionConfig[signal.decision_type] ?? decisionConfig.accept;
  const dateLabel = safeFormatDate(signal.created_at);

  function handleSaveRationale() {
    updateRationale(
      { signalId: signal.id, rationale: rationale || undefined },
      {
        onSuccess: () => {
          toast.success("Rationale updated");
          setEditOpen(false);
        },
        onError: () => toast.error("Failed to update"),
      }
    );
  }

  function handleDelete() {
    deleteSignal(signal.id, {
      onSuccess: () => toast.success("Signal removed"),
      onError: () => toast.error("Failed to remove"),
    });
  }

  return (
    <div className="group flex items-start gap-3 rounded-lg border bg-card px-3 py-2.5 transition-colors hover:bg-muted/30">
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-snug">
            {signal.insight_label ? (
              signal.insight_label
            ) : (
              <span className="italic text-muted-foreground/60">
                Unnamed insight
              </span>
            )}
          </p>
          {dateLabel && (
            <span className="shrink-0 text-[11px] text-muted-foreground/50 tabular-nums">
              {dateLabel}
            </span>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <Badge
            variant="outline"
            className={`px-1.5 py-0 text-[11px] font-medium ${config.badgeClass}`}
          >
            {config.label}
          </Badge>
          {signal.rationale && (
            <span className="text-xs text-muted-foreground">
              {signal.rationale}
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5 pt-0.5">
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              title="Edit rationale"
              className="h-7 w-7 text-muted-foreground/40 hover:text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit rationale</DialogTitle>
              <DialogDescription>
                Why did you make this decision about "{signal.insight_label}"?
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              maxLength={500}
              placeholder="Optional: explain your reasoning"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              {rationale.length}/500
            </p>
            <DialogFooter>
              <Button onClick={handleSaveRationale} disabled={isUpdating}>
                {isUpdating ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Button
          size="icon"
          variant="ghost"
          title="Remove signal"
          onClick={handleDelete}
          disabled={isDeleting}
          className="h-7 w-7 text-muted-foreground/40 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function SignalsList() {
  const { data: signals, isLoading, error } = useInsightSignals();
  const [filter, setFilter] = useState<FilterType>("all");

  const typeCounts = (["accept", "reject", "user_added", "restore"] as InsightDecisionType[]).reduce(
    (acc, type) => {
      acc[type] = signals?.filter((s) => s.decision_type === type).length ?? 0;
      return acc;
    },
    {} as Record<InsightDecisionType, number>
  );

  const activeTypes = (
    Object.entries(typeCounts) as [InsightDecisionType, number][]
  ).filter(([, count]) => count > 0);

  const filtered =
    filter === "all"
      ? (signals ?? [])
      : (signals ?? []).filter((s) => s.decision_type === filter);

  const hasSignals = signals && signals.length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Decision history</CardTitle>
        <CardDescription>
          Your past accept, reject, and add decisions. These signals teach the
          AI what kinds of insights matter to you.
        </CardDescription>

        {hasSignals && activeTypes.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            <button
              onClick={() => setFilter("all")}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                filter === "all"
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              All
              <span className="tabular-nums opacity-70">
                {signals.length}
              </span>
            </button>
            {activeTypes.map(([type, count]) => {
              const config = decisionConfig[type];
              const isActive = filter === type;
              return (
                <button
                  key={type}
                  onClick={() => setFilter(type)}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                    isActive
                      ? config.pillActive
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {config.label}
                  <span className="tabular-nums opacity-70">{count}</span>
                </button>
              );
            })}
          </div>
        )}
      </CardHeader>

      <CardContent>
        {isLoading && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Loading signals…
          </p>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
            <p className="text-sm text-destructive">
              Failed to load signals. Please try again.
            </p>
          </div>
        )}

        {!isLoading && !error && !hasSignals && (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <p className="text-sm font-medium text-muted-foreground">
              No decisions recorded yet
            </p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              Accept or reject AI-suggested insights during a consultation — each
              choice trains the AI to match your style.
            </p>
          </div>
        )}

        {!isLoading && !error && hasSignals && filtered.length === 0 && (
          <div className="rounded-lg border border-dashed p-4 text-center">
            <p className="text-sm text-muted-foreground">
              No{" "}
              {filter !== "all"
                ? decisionConfig[filter as InsightDecisionType]?.label.toLowerCase()
                : ""}{" "}
              signals.
            </p>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="space-y-1.5">
            {filtered.map((signal) => (
              <SignalItem key={signal.id} signal={signal} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
