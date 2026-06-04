"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface GroupConfirmPanelProps {
  isLoading: boolean;
  isConfirming: boolean;
  suggestion: { name: string; description: string } | null;
  onConfirm: (name: string, description: string, isBrainstorming: boolean) => void;
  onCancel: () => void;
}

export function GroupConfirmPanel({
  isLoading,
  isConfirming,
  suggestion,
  onConfirm,
  onCancel,
}: GroupConfirmPanelProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isBrainstorming, setIsBrainstorming] = useState(false);
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
    onConfirm(name.trim(), description.trim(), isBrainstorming);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            disabled={isConfirming}
            className="rounded-md p-0.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
            aria-label="Back"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-muted-foreground/60" />
            <p className="text-sm font-medium">Name this group</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="space-y-3 py-2">
            <div className="h-3.5 w-3/5 animate-pulse rounded bg-muted" />
            <div className="h-3 w-full animate-pulse rounded bg-muted" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
            <p className="pt-1 text-[11px] text-muted-foreground">
              Suggesting a name…
            </p>
          </div>
        ) : (
          <div className="space-y-4">
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
                  "text-sm font-medium",
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
                rows={4}
                disabled={isConfirming}
                className="resize-none text-sm"
              />
            </div>
            <label
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                isBrainstorming ? "border-foreground/30 bg-muted/40" : "border-border/60",
                isConfirming && "pointer-events-none opacity-60"
              )}
            >
              <Checkbox
                checked={isBrainstorming}
                onCheckedChange={(v) => setIsBrainstorming(Boolean(v))}
                disabled={isConfirming}
              />
              <span className="text-sm leading-snug">Mark as brainstorming</span>
            </label>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 border-t bg-muted/20 px-4 py-3">
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
  );
}
