"use client";

import { useState } from "react";
import { Loader2, Sparkles, Check, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  suggestThemeGroups,
  type SuggestedThemeGroup,
} from "@/lib/actions/consultation-workflow";
import type { SourceTheme } from "@/types/round-detail";

interface AiThemeGroupSuggestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roundLabel: string | null;
  sourceThemes: SourceTheme[];           // All ungrouped source themes
  onAcceptSuggestion: (suggestion: SuggestedThemeGroup) => Promise<void>;
}

export function AiThemeGroupSuggestionDialog({
  open,
  onOpenChange,
  roundLabel,
  sourceThemes,
  onAcceptSuggestion,
}: AiThemeGroupSuggestionDialogProps) {
  const [selectedFocusLabels, setSelectedFocusLabels] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedThemeGroup[]>([]);
  const [acceptedLabels, setAcceptedLabels] = useState<Set<string>>(new Set());
  const [rejectedLabels, setRejectedLabels] = useState<Set<string>>(new Set());

  // Unique labels across all source themes for the focus picker
  const uniqueThemeLabels = Array.from(new Set(sourceThemes.map((t) => t.label))).sort();

  const themeById = new Map(sourceThemes.map((t) => [t.id, t]));

  const toggleFocus = (label: string) => {
    setSelectedFocusLabels((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const handleSelectAllFocusThemes = () => {
    setSelectedFocusLabels(new Set(uniqueThemeLabels));
  };

  const handleSuggest = async () => {
    if (selectedFocusLabels.size < 2) return;

    setIsLoading(true);
    setSuggestions([]);
    setAcceptedLabels(new Set());
    setRejectedLabels(new Set());

    try {
      const themeInputs = sourceThemes.map((t) => ({
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
    try {
      await onAcceptSuggestion(suggestion);
      setAcceptedLabels((prev) => new Set([...prev, suggestion.label]));
    } catch {
      toast.error("Failed to create theme group");
    }
  };

  const handleReject = (suggestion: SuggestedThemeGroup) => {
    setRejectedLabels((prev) => new Set([...prev, suggestion.label]));
  };

  const handleClose = () => {
    onOpenChange(false);
    setSelectedFocusLabels(new Set());
    setSuggestions([]);
    setAcceptedLabels(new Set());
    setRejectedLabels(new Set());
  };

  const activeSuggestions = suggestions.filter((s) => !rejectedLabels.has(s.label));

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            AI Suggested Theme Groups
          </DialogTitle>
          <DialogDescription>
            Select 2 or more themes as focus areas. The AI will suggest how all
            source themes naturally cluster around them.
          </DialogDescription>
        </DialogHeader>

        {/* Focus theme picker */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Select focus themes</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSelectAllFocusThemes}
              disabled={uniqueThemeLabels.length === 0}
              className="h-7 px-2.5 text-xs"
            >
              Select all
            </Button>
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto border rounded-md p-3">
            {uniqueThemeLabels.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No ungrouped themes available.
              </p>
            ) : (
              uniqueThemeLabels.map((label) => (
                <div key={label} className="flex items-center gap-2">
                  <Checkbox
                    id={`focus-${label}`}
                    checked={selectedFocusLabels.has(label)}
                    onCheckedChange={() => toggleFocus(label)}
                  />
                  <Label
                    htmlFor={`focus-${label}`}
                    className="text-sm cursor-pointer leading-snug"
                  >
                    {label}
                  </Label>
                </div>
              ))
            )}
          </div>

          <Button
            onClick={handleSuggest}
            disabled={selectedFocusLabels.size < 2 || isLoading}
            className="w-full"
            variant="secondary"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analysing…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Suggest Groups
                {selectedFocusLabels.size < 2 && " (select 2+ themes)"}
              </>
            )}
          </Button>
        </div>

        {/* Suggestions */}
        {activeSuggestions.length > 0 && (
          <div className="space-y-3 pt-2 border-t">
            <p className="text-sm font-medium">
              {activeSuggestions.length} suggestion
              {activeSuggestions.length !== 1 ? "s" : ""}
            </p>
            {activeSuggestions.map((suggestion) => {
              const isAccepted = acceptedLabels.has(suggestion.label);
              return (
                <div key={suggestion.label} className="rounded-md border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{suggestion.label}</p>
                    <div className="flex gap-1 shrink-0">
                      {isAccepted ? (
                        <Badge variant="default" className="text-xs">
                          Created
                        </Badge>
                      ) : (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-green-600 hover:text-green-700"
                            onClick={() => handleAccept(suggestion)}
                            aria-label="Accept suggestion"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={() => handleReject(suggestion)}
                            aria-label="Reject suggestion"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {suggestion.explanation}
                  </p>

                  {/* Show theme labels in the suggestion */}
                  <div className="flex flex-wrap gap-1">
                    {suggestion.theme_ids.map((id) => {
                      const theme = themeById.get(id);
                      return (
                        <Badge key={id} variant="outline" className="text-xs">
                          {theme?.label ?? id}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
