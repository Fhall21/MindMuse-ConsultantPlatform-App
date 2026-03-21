"use client";

import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useCanvasSuggestions,
  useAcceptSuggestion,
  useRejectSuggestion,
  useGenerateSuggestions,
} from "@/hooks/use-canvas";
import type { AiConnectionSuggestion, CanvasNode, ConnectionType } from "@/types/canvas";

// ---------------------------------------------------------------------------
// Human-readable connection type labels
// ---------------------------------------------------------------------------

const CONNECTION_LABELS: Record<ConnectionType, string> = {
  causes: "causes",
  influences: "influences",
  supports: "supports",
  contradicts: "contradicts",
  related_to: "related to",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AiSuggestionsPanelProps {
  roundId: string;
  nodes: CanvasNode[];
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Individual suggestion card
// ---------------------------------------------------------------------------

function SuggestionCard({
  suggestion,
  nodes,
  roundId,
}: {
  suggestion: AiConnectionSuggestion;
  nodes: CanvasNode[];
  roundId: string;
}) {
  const accept = useAcceptSuggestion(roundId);
  const reject = useRejectSuggestion(roundId);

  const sourceLabel =
    nodes.find((n) => n.id === suggestion.source_node_id)?.label ?? suggestion.source_node_id;
  const targetLabel =
    nodes.find((n) => n.id === suggestion.target_node_id)?.label ?? suggestion.target_node_id;
  const connectionLabel = CONNECTION_LABELS[suggestion.suggested_connection_type] ?? suggestion.suggested_connection_type;

  const isPending = accept.isPending || reject.isPending;

  return (
    <div className="rounded-md border p-3 space-y-2">
      <p className="text-sm font-medium leading-snug">
        <span className="text-foreground">{sourceLabel}</span>
        <span className="text-muted-foreground"> {connectionLabel} </span>
        <span className="text-foreground">{targetLabel}</span>
      </p>
      {suggestion.rationale && (
        <p className="text-xs text-muted-foreground leading-relaxed">{suggestion.rationale}</p>
      )}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="default"
          className="flex-1"
          disabled={isPending}
          onClick={() => accept.mutate(suggestion.id)}
        >
          {accept.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
          Accept
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1 text-destructive hover:bg-destructive hover:text-destructive-foreground"
          disabled={isPending}
          onClick={() => reject.mutate(suggestion.id)}
        >
          {reject.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
          Reject
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function AiSuggestionsPanel({
  roundId,
  nodes,
  onClose,
}: AiSuggestionsPanelProps) {
  const { data: suggestions, isLoading } = useCanvasSuggestions(roundId);
  const generate = useGenerateSuggestions(roundId);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <p className="text-sm font-medium">AI Suggestions</p>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </Button>
      </div>

      {/* Generate button */}
      <div className="px-4 py-3 shrink-0">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          disabled={generate.isPending}
          onClick={() => generate.mutate()}
        >
          {generate.isPending ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin mr-2" />
              Generating…
            </>
          ) : (
            "Generate suggestions"
          )}
        </Button>
      </div>

      <Separator />

      {/* List */}
      <ScrollArea className="flex-1">
        <div className="px-4 py-3 space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <span className="text-xs">Loading…</span>
            </div>
          ) : !suggestions || suggestions.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center leading-relaxed">
              No pending suggestions.
              <br />
              Click Generate to analyse the network.
            </p>
          ) : (
            suggestions.map((suggestion) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                nodes={nodes}
                roundId={roundId}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
