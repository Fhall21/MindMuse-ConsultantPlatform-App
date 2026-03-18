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

  function handleConfirm() {
    if (rationale.trim()) {
      onConfirm(rationale.trim());
      setRationale("");
    }
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
            {isLocked ? (
              <span className="mt-1 block text-amber-600 dark:text-amber-400">
                This theme was accepted at the consultation level. A management
                rationale is required to exclude it from the round.
              </span>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="rejection-rationale">
            Rationale <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="rejection-rationale"
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            placeholder="Explain why this is being excluded from the round..."
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            Required for compliance. This will be recorded in the audit trail.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!rationale.trim()}
          >
            Reject with rationale
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
