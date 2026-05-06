"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface FrameRenameDialogProps {
  open: boolean;
  initialName: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string) => void | Promise<void>;
}

/**
 * Native shadcn dialog for renaming a frame. Replaces the previous
 * window.prompt() — that pattern broke design consistency and lost focus
 * styling on the canvas.
 */
export function FrameRenameDialog({
  open,
  initialName,
  onOpenChange,
  onSubmit,
}: FrameRenameDialogProps) {
  const [value, setValue] = useState(initialName);
  const [submitting, setSubmitting] = useState(false);

  // Reset to the latest initialName whenever the dialog re-opens. Avoids
  // stale state when the consultant renames frame A then opens frame B.
  useEffect(() => {
    if (open) setValue(initialName);
  }, [open, initialName]);

  async function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed || trimmed === initialName) {
      onOpenChange(false);
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rename frame</DialogTitle>
          <DialogDescription>
            Frame names appear as section headings in the report and on the
            canvas. Keep them short.
          </DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void handleSubmit();
            }
          }}
          placeholder="e.g. Current presentation"
          maxLength={80}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !value.trim()}>
            {submitting ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
