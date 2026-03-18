"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RoundThemeGroupDraft } from "@/types/round-detail";

interface AIDraftReviewProps {
  currentLabel: string;
  currentDescription: string | null;
  draft: RoundThemeGroupDraft;
  onAccept: () => void;
  onDiscard: () => void;
  disabled?: boolean;
}

export function AIDraftReview({
  currentLabel,
  currentDescription,
  draft,
  onAccept,
  onDiscard,
  disabled,
}: AIDraftReviewProps) {
  return (
    <div className="mt-3 rounded-md border border-dashed border-violet-300 bg-violet-50/50 p-3 dark:border-violet-800 dark:bg-violet-950/20">
      <div className="mb-2 flex items-center gap-2">
        <Badge
          variant="outline"
          className="border-violet-200 bg-violet-100 text-violet-700 dark:border-violet-800 dark:bg-violet-900/40 dark:text-violet-300"
        >
          AI Draft
        </Badge>
        <span className="text-xs text-muted-foreground">
          Suggested refinement after structural change
        </span>
      </div>

      <div className="space-y-2 text-sm">
        {draft.draftLabel !== currentLabel ? (
          <div>
            <span className="text-xs font-medium text-muted-foreground">Label:</span>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground line-through">{currentLabel}</span>
              <span className="text-foreground">&rarr; {draft.draftLabel}</span>
            </div>
          </div>
        ) : null}

        {draft.draftDescription !== currentDescription ? (
          <div>
            <span className="text-xs font-medium text-muted-foreground">Description:</span>
            <p className="text-foreground">{draft.draftDescription ?? "(none)"}</p>
          </div>
        ) : null}

        {draft.draftExplanation ? (
          <p className="text-xs text-muted-foreground italic">
            {draft.draftExplanation}
          </p>
        ) : null}
      </div>

      <div className="mt-3 flex gap-2">
        <Button size="sm" className="h-7 text-xs" onClick={onAccept} disabled={disabled}>
          Accept draft
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={onDiscard}
          disabled={disabled}
        >
          Discard
        </Button>
      </div>
    </div>
  );
}
