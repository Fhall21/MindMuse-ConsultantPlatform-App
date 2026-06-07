"use client";

import { useEffect, useState } from "react";
import { Check, ExternalLink, Pencil, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { QuoteCard } from "@/components/grid/quote-card";
import type {
  GridCell,
  GridReviewState,
  InsightWithLinks,
} from "@/types/grid";

export interface EvidencePanelProps {
  selectedCell: GridCell | null;
  selectedInsight: InsightWithLinks | null;
  onInsightSelect: (insightId: string) => void;
  onInsightReview: (
    insightId: string,
    state: GridReviewState,
    cellId: string,
    editedText?: string,
    editScope?: "cell" | "all"
  ) => void;
  insights: InsightWithLinks[];
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1.5 p-6 text-center">
      <p className="text-sm font-medium text-muted-foreground">
        Select an insight in the grid
      </p>
      <p className="text-xs leading-5 text-muted-foreground/60">
        Click an insight row to review its supporting quotes here.
      </p>
    </div>
  );
}

function connectedStateIcon(
  state: GridReviewState,
  accepted: boolean
): { symbol: string; className: string } {
  if (state === "accepted" || accepted)
    return { symbol: "✓", className: "text-emerald-600 dark:text-emerald-400" };
  if (state === "rejected")
    return { symbol: "✗", className: "text-destructive" };
  return { symbol: "○", className: "text-muted-foreground/60" };
}

export function EvidencePanel({
  selectedCell,
  selectedInsight,
  onInsightReview,
  insights,
}: EvidencePanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [showScopePrompt, setShowScopePrompt] = useState(false);

  useEffect(() => {
    setIsEditing(false);
    setEditText("");
    setShowScopePrompt(false);
  }, [selectedCell?.id]);

  if (!selectedCell || insights.length === 0) {
    return <EmptyState />;
  }

  const activeInsight = selectedInsight ?? insights[0];
  const activeIndex = insights.findIndex((i) => i.id === activeInsight.id);
  const current = activeIndex === -1 ? insights[0] : insights[activeIndex];
  const displayLabel = current.editedLabel ?? current.label;
  const isOnCanvas = current.gridReviewState === "accepted" && current.accepted;
  const isAccepted = current.gridReviewState === "accepted";
  const isRejected = current.gridReviewState === "rejected";

  function handleStartEdit() {
    setEditText(displayLabel);
    setIsEditing(true);
    setShowScopePrompt(false);
  }

  function handleCancelEdit() {
    setIsEditing(false);
    setEditText("");
    setShowScopePrompt(false);
  }

  function handleSaveEdit() {
    if (current.connectedColumns.length > 1) {
      setShowScopePrompt(true);
    } else {
      commitEdit("all");
    }
  }

  function commitEdit(scope: "cell" | "all") {
    onInsightReview(current.id, "edited", current.gridCellId, editText, scope);
    setIsEditing(false);
    setEditText("");
    setShowScopePrompt(false);
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          {isEditing ? (
            <Textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="min-h-[4.5rem] flex-1 resize-none text-sm"
              autoFocus
            />
          ) : (
            <p
              className={cn(
                "line-clamp-3 flex-1 text-sm font-medium leading-5",
                isRejected && "text-muted-foreground line-through"
              )}
              title={displayLabel}
            >
              {displayLabel}
            </p>
          )}
          {isOnCanvas && (
            <Badge
              variant="outline"
              className="shrink-0 border-emerald-200 bg-emerald-100/80 text-[10px] text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-200"
            >
              On canvas
            </Badge>
          )}
        </div>
      </div>

      {/* Scrollable evidence quotes */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="px-4 py-3">
          {current.quotes.length === 0 ? (
            <p className="text-xs text-muted-foreground">No supporting quotes.</p>
          ) : (
            <div className="space-y-2">
              {current.quotes.map((quote) => (
                <QuoteCard
                  key={quote.id}
                  quote={quote}
                  meetingId={selectedCell.meetingId}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Connected to questions */}
      {current.connectedColumns.length > 0 && (
        <div className="shrink-0 border-t px-4 py-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Connected to questions
          </p>
          <ul className="space-y-1.5">
            {current.connectedColumns.map((col) => {
              const icon = connectedStateIcon(col.gridReviewState, col.accepted);
              return (
                <li
                  key={col.columnId}
                  className="flex items-start gap-1.5 text-xs"
                >
                  <span
                    className={cn("mt-px shrink-0 text-[11px]", icon.className)}
                  >
                    {icon.symbol}
                  </span>
                  <span
                    className="line-clamp-1 text-muted-foreground"
                    title={col.question}
                  >
                    {col.question.length > 60
                      ? `${col.question.slice(0, 60)}…`
                      : col.question}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="shrink-0 border-t px-4 py-3">
        {isEditing ? (
          showScopePrompt ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Insight appears in multiple questions. Save where?
              </p>
              <div className="flex flex-col gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full justify-start text-xs"
                  onClick={() => commitEdit("cell")}
                >
                  This question only
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full justify-start text-xs"
                  onClick={() => commitEdit("all")}
                >
                  All questions
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="w-full justify-start text-xs text-muted-foreground"
                  onClick={handleCancelEdit}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                onClick={handleSaveEdit}
                disabled={!editText.trim() || editText === displayLabel}
              >
                Save edit
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleCancelEdit}
              >
                Cancel
              </Button>
            </div>
          )
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {!isAccepted && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5 border-transparent text-muted-foreground hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:border-emerald-900/60 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
                onClick={() =>
                  onInsightReview(current.id, "accepted", current.gridCellId)
                }
              >
                <Check className="size-3.5" aria-hidden="true" />
                Accept
              </Button>
            )}
            {!isRejected && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5 border-transparent text-muted-foreground hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                onClick={() =>
                  onInsightReview(current.id, "rejected", current.gridCellId)
                }
              >
                <X className="size-3.5" aria-hidden="true" />
                Reject
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="gap-1.5 text-muted-foreground"
              onClick={handleStartEdit}
            >
              <Pencil className="size-3.5" aria-hidden="true" />
              Edit text
            </Button>
            {current.quotes.length > 0 && (
              <a
                href={`/meetings/${selectedCell.meetingId}?highlight=${current.quotes[0].id}`}
                className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="size-3.5" aria-hidden="true" />
                Open in transcript
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
