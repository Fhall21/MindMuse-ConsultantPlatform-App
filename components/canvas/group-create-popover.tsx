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
        className="pointer-events-auto w-[340px] border border-border bg-background shadow-md"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-muted-foreground/60" />
            <span className="text-sm font-medium tracking-tight">Name this group</span>
          </div>
          <button
            onClick={onCancel}
            disabled={isConfirming}
            className="text-muted-foreground/50 hover:text-foreground transition-colors disabled:opacity-40"
            aria-label="Cancel"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Body */}
        {isLoading ? (
          <div className="space-y-3 px-5 py-5">
            <div className="h-3.5 w-3/5 animate-pulse rounded-sm bg-muted" />
            <div className="h-3 w-full animate-pulse rounded-sm bg-muted" />
            <div className="h-3 w-4/5 animate-pulse rounded-sm bg-muted" />
          </div>
        ) : (
          <div className="px-5 py-4 space-y-4">
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
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
                  "rounded-none text-sm font-medium transition-colors",
                  nameError && "border-destructive focus-visible:ring-destructive"
                )}
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Description
              </p>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What connects these insights…"
                maxLength={300}
                rows={3}
                disabled={isConfirming}
                className="resize-none rounded-none text-sm"
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isConfirming}
            className="rounded-none text-xs"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={isLoading || isConfirming}
            onClick={tryConfirm}
            className="rounded-none text-xs"
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
