"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  useInsightSignals,
  useUpdateSignalRationale,
  useDeleteSignal,
} from "@/hooks/use-insight-signals";
import { toast } from "sonner";
import type { InsightDecisionLog } from "@/types/db";

const decisionStyle: Record<string, { label: string; className: string }> = {
  accept: {
    label: "Accepted",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  reject: {
    label: "Rejected",
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  },
  user_added: {
    label: "Added by you",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  },
};

function SignalItem({ signal }: { signal: InsightDecisionLog }) {
  const [editOpen, setEditOpen] = useState(false);
  const [rationale, setRationale] = useState(signal.rationale ?? "");
  const { mutate: updateRationale, isPending: isUpdating } =
    useUpdateSignalRationale();
  const { mutate: deleteSignal, isPending: isDeleting } = useDeleteSignal();

  const style = decisionStyle[signal.decision_type] ?? decisionStyle.accept;

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
    <div className="flex items-start gap-3 rounded-lg border p-3">
      <Badge className={style.className}>{style.label}</Badge>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{signal.insight_label}</p>
        {signal.rationale && (
          <p className="mt-0.5 text-sm text-muted-foreground">
            {signal.rationale}
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {new Date(signal.created_at).toLocaleDateString()}
        </p>
      </div>
      <div className="flex shrink-0 gap-1">
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="ghost">
              Edit
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
              <Button
                onClick={handleSaveRationale}
                disabled={isUpdating}
              >
                {isUpdating ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleDelete}
          disabled={isDeleting}
          className="text-destructive hover:text-destructive"
        >
          Remove
        </Button>
      </div>
    </div>
  );
}

export function SignalsList() {
  const { data: signals, isLoading, error } = useInsightSignals();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Decision history</CardTitle>
        <CardDescription>
          Your past accept, reject, and add decisions. These signals teach the AI
          what kinds of insights matter to you.
        </CardDescription>
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

        {!isLoading && !error && (!signals || signals.length === 0) && (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No feedback yet. Run your first consultation and accept or reject
              the suggested insights to start building your personalisation
              profile.
            </p>
          </div>
        )}

        {signals && signals.length > 0 && (
          <div className="space-y-2">
            {signals.map((signal) => (
              <SignalItem key={signal.id} signal={signal} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
