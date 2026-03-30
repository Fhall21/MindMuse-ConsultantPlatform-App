"use client";

import { useState } from "react";
import { Loader2, Sparkles, Check, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  suggestConsultationGroups,
  type SuggestedConsultationGroup,
  type ConsultationThemeInput,
} from "@/lib/actions/consultation-groups";
import type { SourceTheme, RoundConsultationSummary } from "@/types/round-detail";

interface AiGroupSuggestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roundLabel: string | null;
  acceptedThemes: SourceTheme[];          // All source themes from the round
  meetings: RoundConsultationSummary[];
  onAcceptSuggestion: (suggestion: SuggestedConsultationGroup) => Promise<void>;
}

export function AiGroupSuggestionDialog({
  open,
  onOpenChange,
  roundLabel,
  acceptedThemes,
  meetings,
  onAcceptSuggestion,
}: AiGroupSuggestionDialogProps) {
  const [selectedThemeLabels, setSelectedThemeLabels] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedConsultationGroup[]>([]);
  const [acceptedSuggestionLabels, setAcceptedSuggestionLabels] = useState<Set<string>>(new Set());
  const [rejectedSuggestionLabels, setRejectedSuggestionLabels] = useState<Set<string>>(new Set());

  // Deduplicate theme labels across meetings
  const uniqueThemeLabels = Array.from(
    new Set(acceptedThemes.map((t) => t.label))
  ).sort();

  const toggleTheme = (label: string) => {
    setSelectedThemeLabels((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const handleSuggest = async () => {
    if (selectedThemeLabels.size < 2) return;

    setIsLoading(true);
    setSuggestions([]);
    setAcceptedSuggestionLabels(new Set());
    setRejectedSuggestionLabels(new Set());

    try {
      // Build meeting theme input: group themes by meeting
      const themesByMeeting = new Map<string, SourceTheme[]>();
      for (const theme of acceptedThemes) {
        const existing = themesByMeeting.get(theme.sourceMeetingId) ?? [];
        themesByMeeting.set(theme.sourceMeetingId, [...existing, theme]);
      }

      const consultationInputs: ConsultationThemeInput[] = meetings.map((meeting) => {
        const themes = themesByMeeting.get(meeting.id) ?? [];
        return {
          consultation_id: meeting.id,
          consultation_title: meeting.title,
          theme_labels: themes.map((t) => t.label),
          theme_descriptions: themes.map((t) => t.description ?? ""),
        };
      });

      const result = await suggestConsultationGroups(
        roundLabel,
        Array.from(selectedThemeLabels),
        consultationInputs
      );

      setSuggestions(result);

      if (result.length === 0) {
        toast.info("No natural groups found for those themes. Try different themes.");
      }
    } catch {
      toast.error("Failed to get AI suggestions. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = async (suggestion: SuggestedConsultationGroup) => {
    try {
      await onAcceptSuggestion(suggestion);
      setAcceptedSuggestionLabels((prev) => new Set([...prev, suggestion.label]));
    } catch {
      toast.error("Failed to create group");
    }
  };

  const handleReject = (suggestion: SuggestedConsultationGroup) => {
    setRejectedSuggestionLabels((prev) => new Set([...prev, suggestion.label]));
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset state when closing
    setSelectedThemeLabels(new Set());
    setSuggestions([]);
    setAcceptedSuggestionLabels(new Set());
    setRejectedSuggestionLabels(new Set());
  };

  const activeSuggestions = suggestions.filter(
    (s) => !rejectedSuggestionLabels.has(s.label)
  );

  const meetingMap = new Map(meetings.map((meeting) => [meeting.id, meeting]));

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            AI Suggested Groups
          </DialogTitle>
          <DialogDescription>
            Select 2 or more themes to cluster around. The AI will suggest which
            meetings naturally share those themes.
          </DialogDescription>
        </DialogHeader>

        {/* Theme picker */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Select focus themes</p>
          <div className="space-y-1.5 max-h-40 overflow-y-auto border rounded-xl p-3">
            {uniqueThemeLabels.length === 0 ? (
              <p className="text-xs text-muted-foreground">No accepted themes in this round yet.</p>
            ) : (
              uniqueThemeLabels.map((label) => (
                <div key={label} className="flex items-center gap-2">
                  <Checkbox
                    id={`theme-${label}`}
                    checked={selectedThemeLabels.has(label)}
                    onCheckedChange={() => toggleTheme(label)}
                  />
                  <Label
                    htmlFor={`theme-${label}`}
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
            disabled={selectedThemeLabels.size < 2 || isLoading}
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
                {selectedThemeLabels.size < 2 && " (select 2+ themes)"}
              </>
            )}
          </Button>
        </div>

        {/* Suggestions */}
        {activeSuggestions.length > 0 && (
          <div className="space-y-3 pt-2 border-t">
            <p className="text-sm font-medium">
              {activeSuggestions.length} suggestion{activeSuggestions.length !== 1 ? "s" : ""}
            </p>
            {activeSuggestions.map((suggestion) => {
              const isAccepted = acceptedSuggestionLabels.has(suggestion.label);
              return (
                <div
                  key={suggestion.label}
                  className="rounded-xl border p-3 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{suggestion.label}</p>
                    <div className="flex gap-1 shrink-0">
                      {isAccepted ? (
                        <Badge variant="default" className="text-xs">Accepted</Badge>
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

                  <div className="flex flex-wrap gap-1">
                    {suggestion.consultation_ids.map((id) => {
                      const meeting = meetingMap.get(id);
                      return (
                        <Badge key={id} variant="outline" className="text-xs">
                          {meeting?.title ?? id}
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
