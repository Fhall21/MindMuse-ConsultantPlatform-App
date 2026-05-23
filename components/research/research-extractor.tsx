"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { BookOpenCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useResearchExtractionEnabled } from "@/hooks/use-research-extraction";
import { ResearchExtractionDialog } from "./research-extraction-dialog";
import type {
  AnalysisArtifact,
  LiteratureReference,
  ResearchSessionType,
} from "@/hooks/use-research";

interface FloatingPosition {
  /** Page-relative pixel coordinates (viewport + scroll). */
  top: number;
  left: number;
}

export interface ResearchExtractorProps {
  /** Required: the research session this answer belongs to. */
  researchSessionId: string;
  sessionType?: ResearchSessionType;
  /** Optional reference list for the per-extraction reference picker (literature). */
  references?: LiteratureReference[];
  /** Analysis artifacts for source context in the dialog. */
  artifacts?: AnalysisArtifact[];
  /** Pre-filled source label (e.g. artifact filename) for analysis extractions. */
  sourceHint?: string | null;
  /** Optional consultation to pre-select in the dialog. */
  initialConsultationId?: string | null;
  /**
   * Minimum selection length (in chars) before the floating action appears.
   * Below this we treat the selection as a stray click, not an extraction intent.
   */
  minSelectionLength?: number;
  className?: string;
  children: ReactNode;
}

/**
 * Wraps a region of research output (typically an AnswerText) and turns text
 * selection inside it into an "Add as insight" action. Renders nothing extra
 * when the feature flag is off — the wrapper is transparent.
 */
export function ResearchExtractor({
  researchSessionId,
  sessionType = "literature",
  references = [],
  artifacts = [],
  sourceHint = null,
  initialConsultationId = null,
  minSelectionLength = 24,
  className,
  children,
}: ResearchExtractorProps) {
  const enabled = useResearchExtractionEnabled();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [floating, setFloating] = useState<FloatingPosition | null>(null);
  const [pendingQuote, setPendingQuote] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const clearFloating = useCallback(() => {
    setFloating(null);
    setPendingQuote("");
  }, []);

  const handleMouseUp = useCallback(() => {
    if (!enabled) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      clearFloating();
      return;
    }

    const container = containerRef.current;
    if (!container) return;
    const range = selection.getRangeAt(0);

    // Bail when the selection straddles outside the wrapper. This keeps the
    // action attached to research text only; selections in unrelated nearby
    // copy do not produce a popover.
    if (
      !container.contains(range.startContainer) ||
      !container.contains(range.endContainer)
    ) {
      clearFloating();
      return;
    }

    const text = selection.toString().trim();
    if (text.length < minSelectionLength) {
      clearFloating();
      return;
    }

    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      clearFloating();
      return;
    }

    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    setPendingQuote(text);
    setFloating({
      top: rect.top + scrollY - 44,
      left: rect.left + scrollX + rect.width / 2,
    });
  }, [clearFloating, enabled, minSelectionLength]);

  // Re-position on window resize / scroll while a selection is active so the
  // button tracks the highlighted text instead of stranding mid-page.
  useEffect(() => {
    if (!floating) return;
    const onScrollOrResize = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        clearFloating();
        return;
      }
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      setFloating({
        top: rect.top + window.scrollY - 44,
        left: rect.left + window.scrollX + rect.width / 2,
      });
    };
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [floating, clearFloating]);

  const handleOpen = () => {
    if (!pendingQuote) return;
    setDialogOpen(true);
  };

  return (
    <>
      <div
        ref={containerRef}
        onMouseUp={handleMouseUp}
        onTouchEnd={handleMouseUp}
        className={cn(enabled && "selection:bg-stone-200/70 dark:selection:bg-stone-700/60", className)}
        data-research-extractor={enabled ? "enabled" : "disabled"}
      >
        {children}
      </div>

      {enabled && floating && !dialogOpen ? (
        <div
          style={{
            position: "absolute",
            top: floating.top,
            left: floating.left,
            transform: "translateX(-50%)",
            zIndex: 50,
          }}
          // Prevent the mousedown from clearing the user's selection before
          // our click handler runs.
          onMouseDown={(e) => e.preventDefault()}
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 rounded-full border bg-background/95 px-3 shadow-sm backdrop-blur-sm"
            onClick={handleOpen}
          >
            <BookOpenCheck className="h-3.5 w-3.5" />
            Add as insight
          </Button>
        </div>
      ) : null}

      <ResearchExtractionDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) clearFloating();
        }}
        researchSessionId={researchSessionId}
        sessionType={sessionType}
        quote={pendingQuote}
        references={references}
        artifacts={artifacts}
        sourceHint={sourceHint}
        initialConsultationId={initialConsultationId}
        onSuccess={() => clearFloating()}
      />
    </>
  );
}
