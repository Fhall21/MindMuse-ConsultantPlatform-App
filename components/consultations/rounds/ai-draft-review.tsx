"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ConsultationThemeGroupDraft } from "@/types/round-detail";

interface AIDraftReviewProps {
  currentLabel: string;
  currentDescription: string | null;
  draft: ConsultationThemeGroupDraft;
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
    <Card size="sm" className="mt-3 ring-1 ring-primary/20">
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline">AI Draft</Badge>
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

        <div className="flex gap-2">
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
      </CardContent>
    </Card>
  );
}
