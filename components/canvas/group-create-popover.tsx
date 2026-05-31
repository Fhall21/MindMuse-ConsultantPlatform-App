"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface GroupCreatePopoverProps {
  isLoading: boolean;
  isConfirming: boolean;
  suggestion: { name: string; description: string } | null;
  onConfirm: (name: string, description: string) => void;
  onCancel: () => void;
}

export function GroupCreatePopover({
  isLoading,
  isConfirming,
  suggestion,
  onConfirm,
  onCancel,
}: GroupCreatePopoverProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [nameError, setNameError] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (suggestion) {
      setName(suggestion.name);
      setDescription(suggestion.description);
    }
  }, [suggestion]);

  useEffect(() => {
    if (!isLoading) {
      setTimeout(() => nameInputRef.current?.focus(), 50);
    }
  }, [isLoading]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);

  function tryConfirm() {
    if (!name.trim()) {
      setNameError(true);
      setTimeout(() => setNameError(false), 1200);
      nameInputRef.current?.focus();
      return;
    }
    onConfirm(name.trim(), description.trim());
  }

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
      <div
        data-testid="group-create-popover"
        className="pointer-events-auto w-[360px] overflow-hidden rounded-lg border border-border/70 bg-background shadow-lg"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-muted-foreground/50" />
            <span className="text-sm font-medium text-foreground/90">Name this group</span>
          </div>
          <button
            onClick={onCancel}
            disabled={isConfirming}
            className="rounded-sm p-0.5 text-muted-foreground/50 transition-colors hover:text-foreground disabled:opacity-40"
            aria-label="Cancel"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Body */}
        {isLoading ? (
          <div className="space-y-3 px-5 py-6">
            <div className="h-3.5 w-3/5 animate-pulse rounded bg-muted" />
            <div className="h-3 w-full animate-pulse rounded bg-muted" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
          </div>
        ) : (
          <div className="px-5 py-5 space-y-4">
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                Group name
              </p>
              <Input
                ref={nameInputRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    tryConfirm();
                  }
                }}
                placeholder="Group name…"
                maxLength={80}
                disabled={isConfirming}
                className={cn(
                  "text-sm font-medium transition-colors",
                  nameError && "border-destructive focus-visible:ring-destructive"
                )}
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                Description
              </p>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What connects these insights…"
                maxLength={300}
                rows={3}
                disabled={isConfirming}
                className="resize-none text-sm"
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border/60 bg-muted/20 px-5 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isConfirming}
            className="text-xs text-muted-foreground"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={isLoading || isConfirming}
            onClick={tryConfirm}
            className="text-xs"
          >
            {isConfirming ? (
              <>
                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                Creating…
              </>
            ) : (
              "Create group"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
