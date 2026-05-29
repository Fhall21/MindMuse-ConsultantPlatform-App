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
    <div
      data-testid="group-create-popover"
      className="absolute bottom-4 right-4 z-20 w-[360px] overflow-hidden rounded-xl border bg-background shadow-xl"
    >
      <div className="flex items-center justify-between border-b px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/40">
            <Sparkles className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-semibold">Name this group</p>
            <p className="text-xs text-muted-foreground">
              AI suggestion — edit before creating
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={onCancel}
          disabled={isConfirming}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3 px-5 py-5">
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
        </div>
      ) : (
        <div className="px-5 py-4 space-y-3">
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
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
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Description
            </p>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What unites these insights…"
              maxLength={300}
              rows={3}
              disabled={isConfirming}
              className="resize-none text-sm"
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isConfirming}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={isLoading || isConfirming}
          onClick={tryConfirm}
        >
          {isConfirming ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Creating…
            </>
          ) : (
            "Create group"
          )}
        </Button>
      </div>
    </div>
  );
}
