"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ColumnAddPanel } from "@/components/grid/column-add-panel";

interface ColumnAddDialogProps {
  roundId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddColumn?: (question: string) => void | Promise<void>;
  /** Prefetch AI suggestions when grid mounts, not only when dialog opens. */
  prefetchSuggestions?: boolean;
}

export function ColumnAddDialog({
  roundId,
  open,
  onOpenChange,
  onAddColumn,
  prefetchSuggestions = false,
}: ColumnAddDialogProps) {
  const [panelKey, setPanelKey] = useState(0);

  useEffect(() => {
    if (!open) {
      setPanelKey((key) => key + 1);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,42rem)] overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="sr-only">
          <DialogTitle>Add analysis question</DialogTitle>
          <DialogDescription>
            Add a question to compare across every meeting in this consultation.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <ColumnAddPanel
            key={panelKey}
            roundId={roundId}
            prefetchSuggestions={prefetchSuggestions || open}
            submitDisabled={!onAddColumn}
            onAddColumn={async (question) => {
              if (!onAddColumn) return;
              await onAddColumn(question);
              onOpenChange(false);
            }}
            onCancel={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
