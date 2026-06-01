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
import { Textarea } from "@/components/ui/textarea";

interface CreateThemeGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName?: string;
  initialDescription?: string;
  selectedCount: number;
  onConfirm: (name: string, description: string) => void;
}

export function CreateThemeGroupDialog({
  open,
  onOpenChange,
  initialName = "",
  initialDescription = "",
  selectedCount,
  onConfirm,
}: CreateThemeGroupDialogProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setDescription(initialDescription);
  }, [initialDescription, initialName, open]);

  function handleConfirm() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(trimmed, description.trim());
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Name theme group</DialogTitle>
          <DialogDescription>
            {selectedCount} insight{selectedCount === 1 ? "" : "s"} selected. Add a label and
            optional description.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Group name</label>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Workplace strain from change"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <Textarea
              value={description}
              rows={3}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional context for this cluster"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={!name.trim()}>
            Add group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
