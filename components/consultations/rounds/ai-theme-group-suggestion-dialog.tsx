"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  suggestThemeGroups,
  type SuggestedThemeGroup,
} from "@/lib/actions/consultation-workflow";
import type { SourceTheme } from "@/types/round-detail";

type Decision = "accepted" | "skipped";

interface AiThemeGroupSuggestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roundLabel: string | null;
  sourceThemes: SourceTheme[];
  initialSelectedIds?: Set<string>;
  onAcceptSuggestion: (suggestion: SuggestedThemeGroup) => Promise<void>;
}

export function AiThemeGroupSuggestionDialog({
  open,
  onOpenChange,
  roundLabel,
  sourceThemes,
  initialSelectedIds,
  onAcceptSuggestion,
}: AiThemeGroupSuggestionDialogProps) {
  const [phase, setPhase] = useState<"setup" | "review">("setup");
  const [selectedFocusLabels, setSelectedFocusLabels] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedThemeGroup[]>([]);
  const [decisions, setDecisions] = useState<Map<string, Decision>>(new Map());
  const [accepting, setAccepting] = useState<Set<string>>(new Set());
  const themeByIdSnapshot = useRef<Map<string, SourceTheme>>(new Map());

  const uniqueThemeLabels = Array.from(
    new Set(sourceThemes.map((t) => t.label))
  ).sort();

  useEffect(() => {
    if (!open || !initialSelectedIds) return;
    const labels = sourceThemes
      .filter((theme) => initialSelectedIds.has(theme.id))
      .map((theme) => theme.label);
    setSelectedFocusLabels(new Set(labels));
  }, [initialSelectedIds, open, sourceThemes]);

  const toggleFocus = (label: string) => {
    setSelectedFocusLabels((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  };

  const handleSuggest = async () => {
    if (selectedFocusLabels.size < 2) return;
    setIsLoading(true);
    setSuggestions([]);
    setDecisions(new Map());
    themeByIdSnapshot.current = new Map(sourceThemes.map((t) => [t.id, t]));

    try {
      const themeInputs = sourceThemes
        .filter((t) => selectedFocusLabels.has(t.label))
        .map((t) => ({
          theme_id: t.id,
          label: t.label,
          description: t.description ?? null,
          consultation_title: t.sourceMeetingTitle,
          is_user_added: t.isUserAdded,
        }));

      const result = await suggestThemeGroups(
        roundLabel,
        Array.from(selectedFocusLabels),
        themeInputs
      );

      setSuggestions(result);
      setPhase("review");

      if (result.length === 0) {
        toast.info("No natural clusters found. Try different focus themes.");
      }
    } catch {
      toast.error("Failed to get AI suggestions. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = async (suggestion: SuggestedThemeGroup) => {
    setAccepting((prev) => new Set([...prev, suggestion.label]));
    try {
      await onAcceptSuggestion(suggestion);
      setDecisions((prev) => new Map(prev).set(suggestion.label, "accepted"));
    } catch {
      toast.error("Failed to create theme group");
    } finally {
      setAccepting((prev) => {
        const next = new Set(prev);
        next.delete(suggestion.label);
        return next;
      });
    }
  };

  const handleSkip = (suggestion: SuggestedThemeGroup) => {
    setDecisions((prev) => new Map(prev).set(suggestion.label, "skipped"));
  };

  const handleUndo = (suggestion: SuggestedThemeGroup) => {
    setDecisions((prev) => {
      const next = new Map(prev);
      next.delete(suggestion.label);
      return next;
    });
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setPhase("setup");
      setSelectedFocusLabels(new Set());
      setSuggestions([]);
      setDecisions(new Map());
    }, 200);
  };

  const acceptedCount = [...decisions.values()].filter((d) => d === "accepted").length;
  const skippedCount = [...decisions.values()].filter((d) => d === "skipped").length;
  const pendingCount = suggestions.length - acceptedCount - skippedCount;
  const allDecided = suggestions.length > 0 && pendingCount === 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className={cn(
          "flex max-h-[85vh] max-w-lg flex-col gap-0 overflow-hidden p-0",
        )}
      >
        {/* ── Header ──────────────────────────────────────────── */}
        <DialogHeader className="shrink-0 border-b border-border/50 px-5 pb-4 pr-12 pt-5">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Sparkles className="h-4 w-4 shrink-0 text-primary" />
            Suggest theme clusters
          </DialogTitle>
          {phase === "setup" && (
            <DialogDescription className="text-xs text-muted-foreground">
              Pick 2 or more themes — the AI will show how all themes
              naturally cluster around them.
            </DialogDescription>
          )}
        </DialogHeader>

        {/* ── Scrollable body ──────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {phase === "setup" ? (
            /* ── Setup ─────────────────────────────────────────── */
            <div className="space-y-3 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Focus themes</p>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedFocusLabels(new Set(uniqueThemeLabels))
                  }
                  className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  Select all
                </button>
              </div>

              <div className="max-h-52 overflow-y-auto rounded-xl border border-border/60 bg-muted/20">
                {uniqueThemeLabels.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-muted-foreground">
                    No ungrouped themes available.
                  </p>
                ) : (
                  <div className="divide-y divide-border/40">
                    {uniqueThemeLabels.map((label) => (
                      <label
                        key={label}
                        className="flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40"
                      >
                        <Checkbox
                          checked={selectedFocusLabels.has(label)}
                          onCheckedChange={() => toggleFocus(label)}
                          className="shrink-0"
                        />
                        <span className="text-sm leading-snug">{label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {selectedFocusLabels.size === 1 && (
                <p className="text-xs text-muted-foreground">
                  Select one more theme to generate clusters.
                </p>
              )}

              <Button
                onClick={handleSuggest}
                disabled={selectedFocusLabels.size < 2 || isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analysing themes…
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate clusters
                    {selectedFocusLabels.size >= 2 && (
                      <span className="ml-1.5 opacity-50">
                        ({selectedFocusLabels.size} selected)
                      </span>
                    )}
                  </>
                )}
              </Button>
            </div>
          ) : (
            /* ── Review ─────────────────────────────────────────── */
            <div>
              {/* Re-run strip */}
              <div className="border-b border-border/40 bg-muted/20 px-5 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-xs text-muted-foreground">
                    Focus:{" "}
                    <span className="font-medium text-foreground">
                      {Array.from(selectedFocusLabels).join(" · ")}
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setPhase("setup")}
                    className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Re-run
                  </button>
                </div>
                {suggestions.length > 0 && (acceptedCount > 0 || skippedCount > 0 || pendingCount > 0) && (
                  <div className="mt-1.5 flex items-center gap-3 text-xs">
                    {pendingCount > 0 && (
                      <span className="text-muted-foreground">{pendingCount} to review</span>
                    )}
                    {acceptedCount > 0 && (
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">
                        {acceptedCount} added
                      </span>
                    )}
                    {skippedCount > 0 && (
                      <span className="text-muted-foreground">{skippedCount} skipped</span>
                    )}
                  </div>
                )}
              </div>

              {suggestions.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-sm text-muted-foreground">
                    No clusters found for these focus themes.
                  </p>
                  <button
                    type="button"
                    onClick={() => setPhase("setup")}
                    className="mt-2 text-xs text-primary underline-offset-2 hover:underline"
                  >
                    Try different themes
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {suggestions.map((suggestion) => {
                    const decision = decisions.get(suggestion.label);
                    const isAccepted = decision === "accepted";
                    const isSkipped = decision === "skipped";
                    const isAccepting = accepting.has(suggestion.label);

                    /* Accepted — compact green row */
                    if (isAccepted) {
                      return (
                        <div
                          key={suggestion.label}
                          className="bg-emerald-50/70 px-5 py-3.5 dark:bg-emerald-950/20"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50">
                              <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                            </span>
                            <span className="text-sm font-medium">
                              {suggestion.label}
                            </span>
                            <span className="ml-auto shrink-0 text-xs text-emerald-600 dark:text-emerald-400">
                              Added to groups
                            </span>
                          </div>
                        </div>
                      );
                    }

                    /* Skipped — dimmed strikethrough + undo */
                    if (isSkipped) {
                      return (
                        <div
                          key={suggestion.label}
                          className="flex items-center justify-between gap-3 px-5 py-3 opacity-45"
                        >
                          <span className="text-sm line-through">
                            {suggestion.label}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUndo(suggestion)}
                            className="shrink-0 text-xs text-muted-foreground underline-offset-2 opacity-100 hover:text-foreground hover:underline"
                          >
                            Undo
                          </button>
                        </div>
                      );
                    }

                    /* Pending — full card */
                    return (
                      <div key={suggestion.label} className="px-5 py-4">
                        <h3 className="text-sm font-semibold leading-snug">
                          {suggestion.label}
                        </h3>
                        <p className="mt-1.5 max-w-prose text-xs leading-relaxed text-muted-foreground">
                          {suggestion.explanation}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {suggestion.theme_ids.map((id) => {
                            const theme = themeByIdSnapshot.current.get(id);
                            return (
                              <span
                                key={id}
                                className="rounded-full border border-border/60 bg-muted/30 px-2.5 py-0.5 text-xs"
                              >
                                {theme?.label ?? id}
                              </span>
                            );
                          })}
                        </div>
                        <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3">
                          <Button
                            size="sm"
                            disabled={isAccepting}
                            onClick={() => handleAccept(suggestion)}
                            className="h-7 px-3 text-xs"
                          >
                            {isAccepting ? (
                              <>
                                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                                Adding…
                              </>
                            ) : (
                              "Add to groups"
                            )}
                          </Button>
                          <button
                            type="button"
                            onClick={() => handleSkip(suggestion)}
                            className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                          >
                            Skip
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────── */}
        <div className="shrink-0 border-t border-border/50 px-5 py-3.5">
          <div className="flex items-center justify-end">
            <Button variant="ghost" size="sm" onClick={handleClose}>
              {allDecided ? "Done" : "Close"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
