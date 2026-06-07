"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBulkAccept } from "@/hooks/use-bulk-accept";
import { useGridInsights } from "@/hooks/use-grid-insights";
import type { InsightWithLinks } from "@/types/grid";

export function getEligibleBulkAcceptTargets(
  insights: InsightWithLinks[],
  completedCellIds: ReadonlySet<string>
) {
  return insights
    .filter(
      (insight) =>
        insight.gridReviewState === "pending" &&
        completedCellIds.has(insight.gridCellId)
    )
    .map(({ id, gridCellId }) => ({ id, gridCellId }));
}

interface BulkAcceptDialogProps {
  roundId: string;
  completedCellIds: ReadonlySet<string>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BulkAcceptDialog({
  roundId,
  completedCellIds,
  open,
  onOpenChange,
}: BulkAcceptDialogProps) {
  const { data, isLoading } = useGridInsights(roundId, open);
  const { bulkAccept, progress } = useBulkAccept(roundId);
  const eligibleInsights = useMemo(
    () =>
      getEligibleBulkAcceptTargets(data?.insights ?? [], completedCellIds),
    [completedCellIds, data?.insights]
  );
  const count = eligibleInsights.length;
  const isAccepting = progress !== null;

  async function handleAccept() {
    if (count === 0 || isAccepting) return;
    await bulkAccept(eligibleInsights);
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isAccepting) onOpenChange(nextOpen);
      }}
    >
      <DialogContent showCloseButton={!isAccepting}>
        <DialogHeader>
          <DialogTitle>
            {isLoading ? "Checking insights..." : `Accept ${count} insights?`}
          </DialogTitle>
          <DialogDescription>
            This will accept {count} insights. This cannot be undone from the
            grid. Accepted insights will be added to your Canvas.
          </DialogDescription>
        </DialogHeader>

        {progress && progress.total > 5 ? (
          <p className="text-sm font-medium" role="status" aria-live="polite">
            Accepting insight {Math.min(progress.current + 1, progress.total)} of{" "}
            {progress.total}...
          </p>
        ) : null}

        {!isLoading && count === 0 ? (
          <p className="text-sm text-muted-foreground">
            No pending insights in completed cells.
          </p>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isAccepting}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isLoading || count === 0 || isAccepting}
            onClick={handleAccept}
          >
            {isAccepting
              ? "Accepting..."
              : `Accept ${count} insight${count === 1 ? "" : "s"} →`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
