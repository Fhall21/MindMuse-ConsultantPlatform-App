"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BookOpen, Loader2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useResearchExtractionEnabled } from "@/hooks/use-feature-flags";
import {
  useResearchInsightLibrary,
  usePlaceResearchInsight,
  type ResearchInsightLibraryEntry,
} from "@/hooks/use-research-extraction";
import {
  EVIDENCE_INSIGHT_MIME,
  REACTFLOW_INSIGHT_MIME,
  useEvidenceDnDOptional,
} from "@/components/canvas/evidence-dnd-provider";

export interface ResearchInsightLibraryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consultationId: string;
  /** Optional position to drop new placements at (centre of the visible canvas). */
  dropPosition?: { x: number; y: number } | null;
  onPlaced?: (insightId: string) => void;
}

/**
 * Library browser for the user's previously-extracted research insights. Place
 * any of them onto the current canvas. Already-placed insights are visually
 * marked but still selectable — placing again is idempotent (upsert in the
 * action layer).
 */
export function ResearchInsightLibraryModal({
  open,
  onOpenChange,
  consultationId,
  dropPosition = null,
  onPlaced,
}: ResearchInsightLibraryModalProps) {
  const enabled = useResearchExtractionEnabled();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 200);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setDebounced("");
    }
  }, [open]);

  const library = useResearchInsightLibrary(debounced.length > 0 ? debounced : null);
  const place = usePlaceResearchInsight();
  const evidenceDnD = useEvidenceDnDOptional();

  const items = useMemo(() => library.data ?? [], [library.data]);

  const handleDragStart = (item: ResearchInsightLibraryEntry, event: React.DragEvent) => {
    event.dataTransfer.setData(EVIDENCE_INSIGHT_MIME, item.insightId);
    event.dataTransfer.setData(
      REACTFLOW_INSIGHT_MIME,
      JSON.stringify({ insightId: item.insightId })
    );
    event.dataTransfer.setData("text/plain", item.label);
    event.dataTransfer.effectAllowed = "move";
    evidenceDnD?.setDragPayload(item);
  };

  const handleDragEnd = () => {
    evidenceDnD?.clearDrag();
  };

  const handlePlace = async (insightId: string) => {
    try {
      await place.mutateAsync({
        consultationId,
        insightId,
        positionX: dropPosition?.x,
        positionY: dropPosition?.y,
      });
      toast.success("Research insight added to canvas");
      onPlaced?.(insightId);
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not place research insight"
      );
    }
  };

  if (!enabled) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Reuse a research insight</DialogTitle>
          <DialogDescription>
            Pull a previously-extracted research insight onto this canvas. The
            same insight can sit on multiple consultations — its source quote and
            reference travel with it.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by label, quote, or research query"
            className="pl-9"
            autoFocus
          />
        </div>

        <ScrollArea className="h-[360px] rounded-md border">
          {library.isLoading ? (
            <div className="flex h-full items-center justify-center py-12 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading library…
            </div>
          ) : items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <BookOpen className="h-6 w-6 opacity-50" />
              {debounced ? (
                <p>No research insights match &ldquo;{debounced}&rdquo;.</p>
              ) : (
                <p>You haven&rsquo;t extracted any research insights yet.</p>
              )}
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((item) => (
                <li
                  key={item.insightId}
                  draggable
                  onDragStart={(event) => handleDragStart(item, event)}
                  onDragEnd={handleDragEnd}
                  className={`flex cursor-grab items-start gap-3 p-3 active:cursor-grabbing ${
                    evidenceDnD?.draggedInsightId === item.insightId ? "opacity-60" : ""
                  }`}
                >
                  <BookOpen className="mt-1 h-4 w-4 shrink-0 text-stone-600 dark:text-stone-300" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-tight text-foreground line-clamp-2">
                      {item.label}
                    </p>
                    {item.description ? (
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground line-clamp-2">
                        {item.description}
                      </p>
                    ) : null}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                        {item.quoteCount} quote{item.quoteCount === 1 ? "" : "s"}
                      </Badge>
                      {item.placementCount > 0 ? (
                        <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                          on {item.placementCount} canvas
                          {item.placementCount === 1 ? "" : "es"}
                        </Badge>
                      ) : null}
                      <span className="truncate">From: {item.researchSessionQuery}</span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handlePlace(item.insightId)}
                    disabled={place.isPending}
                  >
                    {place.isPending && place.variables?.insightId === item.insightId ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      "Add"
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
