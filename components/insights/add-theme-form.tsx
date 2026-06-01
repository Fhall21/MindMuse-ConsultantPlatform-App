"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export interface AddThemeFormProps {
  label: string;
  description: string;
  error: string | null;
  isSubmitting: boolean;
  onLabelChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  heading?: string;
  labelPlaceholder?: string;
}

function LoadingSpinner() {
  return (
    <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
  );
}

export function AddThemeForm({
  label,
  description,
  error,
  isSubmitting,
  onLabelChange,
  onDescriptionChange,
  onSubmit,
  onCancel,
  heading = "Add a custom theme",
  labelPlaceholder = "Theme label…",
}: AddThemeFormProps) {
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      onSubmit();
    }
    if (e.key === "Escape") {
      onCancel();
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-border/80 bg-muted/10 p-3">
      <p className="text-xs font-medium text-muted-foreground">{heading}</p>
      <Input
        autoFocus
        placeholder={labelPlaceholder}
        value={label}
        onChange={(e) => onLabelChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isSubmitting}
        className="h-8 text-sm"
      />
      <Textarea
        placeholder="Brief description (optional)…"
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
        disabled={isSubmitting}
        className="min-h-[60px] text-sm"
      />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={onSubmit} disabled={isSubmitting || !label.trim()}>
          {isSubmitting ? <LoadingSpinner /> : null}
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
