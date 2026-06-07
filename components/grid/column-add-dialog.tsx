"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ColumnAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddColumn?: (question: string) => void | Promise<void>;
}

export function ColumnAddDialog({
  open,
  onOpenChange,
  onAddColumn,
}: ColumnAddDialogProps) {
  const [question, setQuestion] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || !onAddColumn) return;

    setIsSubmitting(true);
    try {
      await onAddColumn(trimmedQuestion);
      setQuestion("");
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form className="grid gap-6" onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add analysis question</DialogTitle>
            <DialogDescription>
              Add a question to compare across every meeting in this consultation.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <label htmlFor="grid-column-question" className="text-sm font-medium">
              Question
            </label>
            <Textarea
              id="grid-column-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Where is support breaking down?"
              rows={4}
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!question.trim() || !onAddColumn || isSubmitting}
            >
              {isSubmitting ? "Adding…" : "Add column"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
