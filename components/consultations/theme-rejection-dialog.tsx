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

interface ThemeRejectionDialogProps {
  open: boolean;
  themeLabel: string;
  requiresRationale: boolean;
  onConfirm: (rationale: string) => Promise<void>;
  onCancel: () => void;
}

function LoadingSpinner() {
  return <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />;
}

export function ThemeRejectionDialog({
  open,
  themeLabel,
  requiresRationale,
  onConfirm,
  onCancel,
}: ThemeRejectionDialogProps) {
  const [rationale, setRationale] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleConfirm() {
    const trimmed = rationale.trim();
    if (requiresRationale && !trimmed) {
      setError("A rationale note is required before rejecting a theme.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await onConfirm(trimmed);
      setRationale("");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCancel() {
    setRationale("");
    setError(null);
    onCancel();
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && !isSubmitting) {
      handleCancel();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Reject theme</DialogTitle>
          <DialogDescription>
            You are rejecting{" "}
            <span className="font-medium text-foreground">&ldquo;{themeLabel}&rdquo;</span>.
            {requiresRationale
              ? " A rationale note is required because this consultation is locked."
              : " You can add an optional note to help future theme extraction better match your preferences."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="rejection-rationale">
            {requiresRationale ? "Rationale" : "Optional note"}{" "}
            {requiresRationale ? (
              <span className="text-destructive" aria-hidden>
                *
              </span>
            ) : null}
          </Label>
          <Textarea
            id="rejection-rationale"
            placeholder={
              requiresRationale
                ? "Explain why this theme is being rejected…"
                : "Share anything that would help the model learn what you prefer…"
            }
            value={rationale}
            onChange={(e) => {
              setRationale(e.target.value);
              if (error) setError(null);
            }}
            rows={3}
            disabled={isSubmitting}
          />
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => void handleConfirm()}
            disabled={isSubmitting || (requiresRationale && !rationale.trim())}
          >
            {isSubmitting ? <LoadingSpinner /> : null}
            Reject theme
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
