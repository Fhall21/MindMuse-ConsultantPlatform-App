"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ManagementRejectionDialogProps {
  open: boolean;
  targetLabel: string;
  targetType: "theme" | "group";
  isLocked?: boolean;
  onConfirm: (rationale: string) => void;
  onCancel: () => void;
}

export function ManagementRejectionDialog({
  open,
  targetLabel,
  targetType,
  isLocked,
  onConfirm,
  onCancel,
}: ManagementRejectionDialogProps) {
  const [rationale, setRationale] = useState("");
  const requiresRationale = Boolean(isLocked);

  function handleConfirm() {
    if (requiresRationale && !rationale.trim()) return;
    onConfirm(rationale.trim());
    setRationale("");
  }

  function handleCancel() {
    setRationale("");
    onCancel();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Management Rejection</DialogTitle>
          <DialogDescription>
            You are rejecting the {targetType}{" "}
            <span className="font-medium text-foreground">&ldquo;{targetLabel}&rdquo;</span>.
            {requiresRationale ? (
              <span className="mt-1 block text-amber-600 dark:text-amber-400">
                This theme was accepted at the consultation level. A management
                rationale is required to exclude it from the round.
              </span>
            ) : (
              <span className="mt-1 block text-muted-foreground">
                This item is not locked yet, so a note is optional.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="rejection-rationale">
            {requiresRationale ? "Rationale" : "Optional note"}{" "}
            {requiresRationale ? <span className="text-destructive">*</span> : null}
          </Label>
          <Textarea
            id="rejection-rationale"
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            placeholder={
              requiresRationale
                ? "Explain why this is being excluded from the round..."
                : "Share anything that would help the model learn what you prefer..."
            }
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            {requiresRationale
              ? "Required for compliance. This will be recorded in the audit trail."
              : "This will be recorded in the audit trail if you add one."}
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={requiresRationale && !rationale.trim()}
          >
            Reject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
