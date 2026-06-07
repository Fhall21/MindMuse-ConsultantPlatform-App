"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import { toast } from "sonner";
import { Columns2, GripHorizontal, Rows3, Pencil, Trash2, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useMeeting } from "@/hooks/use-meetings";
import { useCreateMeetingTheme, useMeetingThemes } from "@/hooks/use-themes";
import { useMeetingPeople } from "@/hooks/use-people";
import type { Person } from "@/types/db";
import {
  useApproveQuote,
  useCreateQuote,
  useLinkQuoteInsight,
  useMeetingQuotes,
  useRejectQuote,
  useUnlinkQuoteInsight,
  useUpdateQuoteSpeaker,
  useUpdateQuoteSpan,
} from "@/hooks/use-quotes";
import type { QuoteRecord, QuoteStatus } from "@/lib/actions/quotes";
import { cn } from "@/lib/utils";

interface QuoteReviewPanelProps {
  meetingId: string;
}

type Selection = {
  spanStart: number;
  spanEnd: number;
  text: string;
  rect: { top: number; left: number; bottom: number; width: number };
};

function clampPanelPosition(value: number, size: number, viewportSize: number) {
  const margin = 12;
  return Math.max(margin, Math.min(value, viewportSize - size - margin));
}

function useFloatingPanelDrag(ref: RefObject<HTMLDivElement | null>) {
  return useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      const node = ref.current;
      if (!node) return;

      event.preventDefault();
      const rect = node.getBoundingClientRect();
      const originX = event.clientX;
      const originY = event.clientY;
      const originLeft = rect.left;
      const originTop = rect.top;

      function handleMove(moveEvent: PointerEvent) {
        if (!node) return;
        node.style.left = `${clampPanelPosition(
          originLeft + moveEvent.clientX - originX,
          rect.width,
          window.innerWidth
        )}px`;
        node.style.top = `${clampPanelPosition(
          originTop + moveEvent.clientY - originY,
          rect.height,
          window.innerHeight
        )}px`;
        node.style.transform = "none";
        node.style.visibility = "visible";
      }

      function handleUp() {
        window.removeEventListener("pointermove", handleMove);
      }

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp, { once: true });
    },
    [ref]
  );
}

type ViewMode = "workspace" | "compact";

type InsightOption = { id: string; label: string };

const STATUS_LABEL: Record<QuoteStatus, string> = {
  suggested: "Suggested",
  approved: "Approved",
  rejected: "Rejected",
};

const STATUS_ORDER: QuoteStatus[] = ["suggested", "approved", "rejected"];

const VIEW_MODE_STORAGE_KEY = "mindmuse.quote-review.view-mode";

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return "Something went wrong. Please try again.";
}

function InlineNewInsight({
  value,
  onChange,
  onCreate,
  busy,
}: {
  value: string;
  onChange: (value: string) => void;
  onCreate: () => void;
  busy: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="New insight"
        className="h-8 min-w-0 flex-1 text-sm"
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={onCreate}
        disabled={busy || value.trim().length === 0}
      >
        Add
      </Button>
    </div>
  );
}

/**
 * View-mode preference that persists in localStorage. Defaults to compact —
 * the wider workspace layout is opt-in so people who prefer the stacked
 * vertical flow are not surprised on first visit.
 */
function useViewMode(): [ViewMode, (mode: ViewMode) => void] {
  const [mode, setMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "compact";
    const stored = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    return stored === "workspace" || stored === "compact" ? stored : "workspace";
  });

  const update = useCallback((next: ViewMode) => {
    setMode(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, next);
    }
  }, []);

  return [mode, update];
}

/**
 * Read-only transcript with approved + suggested quote spans highlighted.
 * Captures manual selections with exact offsets into meetings.transcript_raw.
 *
 * Highlight rules:
 *   approved   → quiet brand tint
 *   suggested  → warm warning tint (needs review)
 *   focused    → strong ring (the quote the user is looking at right now)
 */
function TranscriptReadout({
  transcript,
  quotes,
  focusedQuoteId,
  onSelection,
  onSpanClick,
}: {
  transcript: string;
  quotes: QuoteRecord[];
  focusedQuoteId: string | null;
  onSelection: (selection: Selection | null) => void;
  onSpanClick: (quoteId: string, rect: DOMRect) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  const segments = useMemo(() => {
    if (!transcript) {
      return [{ text: "", quote: null as QuoteRecord | null, key: "empty" }];
    }
    const ordered = quotes
      .slice()
      .sort((a, b) => a.spanStart - b.spanStart);

    const slices: Array<{ text: string; quote: QuoteRecord | null; key: string }> = [];
    let cursor = 0;
    let idx = 0;
    for (const quote of ordered) {
      if (quote.spanStart < cursor) continue;
      if (quote.spanStart > cursor) {
        slices.push({
          text: transcript.slice(cursor, quote.spanStart),
          quote: null,
          key: `plain-${idx++}`,
        });
      }
      slices.push({
        text: transcript.slice(quote.spanStart, quote.spanEnd),
        quote,
        key: `quote-${quote.id}`,
      });
      cursor = quote.spanEnd;
    }
    if (cursor < transcript.length) {
      slices.push({ text: transcript.slice(cursor), quote: null, key: "plain-tail" });
    }
    return slices;
  }, [transcript, quotes]);

  const handleMouseUp = useCallback(() => {
    const node = containerRef.current;
    if (!node) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      onSelection(null);
      return;
    }
    const range = selection.getRangeAt(0);
    if (!node.contains(range.commonAncestorContainer)) {
      onSelection(null);
      return;
    }
    const text = range.toString();
    if (!text || text.replace(/\s/g, "").length === 0) {
      onSelection(null);
      return;
    }
    const preRange = range.cloneRange();
    preRange.selectNodeContents(node);
    preRange.setEnd(range.startContainer, range.startOffset);
    const spanStart = preRange.toString().length;
    const rect = range.getBoundingClientRect();
    onSelection({
      spanStart,
      spanEnd: spanStart + text.length,
      text,
      rect: {
        top: rect.top,
        left: rect.left,
        bottom: rect.bottom,
        width: rect.width,
      },
    });
  }, [onSelection]);

  // Scroll the focused quote span into view when the user clicks a quote row.
  useEffect(() => {
    if (!focusedQuoteId) return;
    const node = containerRef.current?.querySelector<HTMLElement>(
      `span[data-quote-id="${focusedQuoteId}"]`
    );
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focusedQuoteId]);

  return (
    <div
      ref={containerRef}
      onMouseUp={handleMouseUp}
      className="whitespace-pre-wrap text-[0.9375rem] leading-7 text-foreground/90 selection:bg-primary/20"
      data-testid="quote-review-transcript"
    >
      {segments.map((segment) =>
        segment.quote ? (
          <span
            key={segment.key}
            data-quote-id={segment.quote.id}
            data-quote-status={segment.quote.status}
            onClick={(event) =>
              onSpanClick(
                segment.quote!.id,
                event.currentTarget.getBoundingClientRect()
              )
            }
            className={cn(
              "qspan cursor-pointer rounded-sm px-0.5 transition-colors border-b-[1.5px] border-dashed",
              segment.quote.status === "approved"
                ? "bg-green-200/40 border-green-700/40 hover:bg-green-300/50"
                : segment.quote.status === "suggested"
                ? "bg-amber-200/50 border-amber-600/50 hover:bg-amber-300/60"
                : "bg-transparent border-muted-foreground/30 opacity-50 hover:bg-muted/20 hover:opacity-80",
              focusedQuoteId === segment.quote.id &&
                "ring-2 ring-ring ring-offset-1 ring-offset-background opacity-100"
            )}
          >
            {segment.text}
          </span>
        ) : (
          <span key={segment.key}>{segment.text}</span>
        )
      )}
    </div>
  );
}

interface SelectionTooltipProps {
  selection: Selection;
  onCapture: () => void;
  onDismiss: () => void;
  busy: boolean;
}

function SelectionTooltip({
  selection,
  onCapture,
  onDismiss,
  busy,
}: SelectionTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const node = tooltipRef.current;
    if (!node) return;
    const tooltipRect = node.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 12;

    const desiredLeft = selection.rect.left + selection.rect.width / 2 - tooltipRect.width / 2;
    const left = Math.max(margin, Math.min(desiredLeft, viewportWidth - tooltipRect.width - margin));

    let top = selection.rect.bottom + 8;
    if (top + tooltipRect.height + margin > viewportHeight) {
      top = selection.rect.top - tooltipRect.height - 8;
    }
    if (top < margin) top = margin;

    node.style.top = `${top}px`;
    node.style.left = `${left}px`;
    node.style.transform = "none";
    node.style.visibility = "visible";
    node.style.pointerEvents = "auto";
  }, [selection.rect]);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onDismiss();
    }
    function handlePointer(event: MouseEvent) {
      if (!tooltipRef.current) return;
      if (tooltipRef.current.contains(event.target as Node)) return;
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) return;
      onDismiss();
    }
    window.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handlePointer);
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handlePointer);
    };
  }, [onDismiss]);

  return (
    <div
      ref={tooltipRef}
      role="dialog"
      aria-label="Capture quote"
      onClick={busy ? undefined : onCapture}
      style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "none",
        zIndex: 50,
        visibility: "hidden",
        pointerEvents: "auto"
      }}
      className={cn(
        "flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-border bg-popover px-3 py-1.5 text-xs font-medium text-popover-foreground shadow-sm transition-colors hover:bg-muted",
        busy && "opacity-50 cursor-not-allowed"
      )}
    >
      <span className="text-muted-foreground text-sm leading-none">+</span> Capture quote
    </div>
  );
}

interface DetailViewPaneProps {
  quote: QuoteRecord;
  insightOptions: InsightOption[];
  busy: boolean;
  onClose: () => void;
  onApprove: (primaryInsightId: string | null, additionalInsightIds: string[], relevanceStrength?: "strong_match" | "partial_support" | "context" | "weak" | null) => Promise<void>;
  onReject: (rejectionReason: string) => Promise<void>;
  onLink: (insightId: string, isPrimary: boolean, relevanceStrength?: "strong_match" | "partial_support" | "context" | "weak" | null) => Promise<void>;
  onUnlink: (insightId: string) => Promise<void>;
  onChangeSpeaker: (speakerLabel: string | null) => Promise<void>;
  onCreateInsight: (label: string) => Promise<InsightOption | null>;
  people: Person[];
  isEditingSpanMode: boolean;
  onSetEditingSpanMode: (mode: boolean) => void;
  currentSelection: Selection | null;
  onUpdateSpan: (selection: Selection) => Promise<void>;
}

function DetailViewPane({
  quote,
  insightOptions,
  busy,
  onClose,
  onApprove,
  onReject,
  onLink,
  onUnlink,
  onChangeSpeaker,
  onCreateInsight,
  people,
  isEditingSpanMode,
  onSetEditingSpanMode,
  currentSelection,
  onUpdateSpan,
}: DetailViewPaneProps) {
  const [showReject, setShowReject] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [newInsightLabel, setNewInsightLabel] = useState("");
  const [approvalRelevanceStrength, setApprovalRelevanceStrength] = useState<"strong_match" | "partial_support" | "context" | "weak" | null>(null);

  const hasPrimary = quote.links.some((link) => link.isPrimary);
  const metadataParts: string[] = [];
  if (quote.workGroupLabel) metadataParts.push(quote.workGroupLabel);
  metadataParts.push(quote.source === "ai" ? "AI suggested" : "Manual");
  if (quote.riskFlag) metadataParts.push("Identifying-risk");

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border/60 p-4">
        <div>
          <span className={cn(
            "text-xs uppercase tracking-widest font-semibold",
            quote.status === "approved" ? "text-green-700" :
            quote.status === "suggested" ? "text-amber-700" : "text-muted-foreground"
          )}>
            {STATUS_LABEL[quote.status]}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {quote.status === "approved" && (
            <>
              <button
                type="button"
                onClick={() => onSetEditingSpanMode(!isEditingSpanMode)}
                title="Edit quote region"
                className="text-muted-foreground hover:text-foreground p-1 leading-none transition-colors"
                disabled={busy}
              >
                <Pencil className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onReject("Deleted by user");
                  toast.success("Moved to rejected tab, you can undo this later.");
                  onClose();
                }}
                title="Delete quote"
                className="text-muted-foreground hover:text-red-600 p-1 leading-none transition-colors"
                disabled={busy}
              >
                <Trash2 className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={onClose}
                title="Done"
                className="text-muted-foreground hover:text-green-600 p-1 leading-none transition-colors ml-1"
              >
                <Check className="size-4" />
              </button>
            </>
          )}
          {quote.status !== "approved" && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-muted-foreground hover:text-foreground p-1 leading-none ml-1"
            >
              ×
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <select
              value={quote.speakerLabel ?? ""}
              onChange={(e) => onChangeSpeaker(e.target.value || null)}
              className="h-7 w-40 rounded-md border border-input bg-background px-2 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              disabled={busy}
            >
              <option value="" disabled>Select a speaker...</option>
              {people.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              <option value="Anonymous">Anonymous</option>
              <option value="Moderator/Facilitator">Moderator/Facilitator</option>
            </select>
            <div className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground text-right">
              {metadataParts.join(" · ")}
            </div>
          </div>
          <div className="space-y-3">
            {isEditingSpanMode && (
              <div className="rounded-md bg-amber-500/10 border border-amber-500/20 p-3 mb-2 space-y-2">
                <p className="text-xs text-amber-700 font-medium">Highlight the new region in the transcript to update this quote.</p>
                {currentSelection && onUpdateSpan && (
                  <div className="space-y-2">
                    <p className="text-sm italic opacity-80 border-l-2 border-amber-500/50 pl-2">"{currentSelection.text}"</p>
                    <Button size="sm" onClick={() => onUpdateSpan(currentSelection)} disabled={busy} className="w-full">
                      Confirm new region
                    </Button>
                  </div>
                )}
              </div>
            )}
            <p className={cn("text-sm italic leading-relaxed text-foreground", isEditingSpanMode && "opacity-50 line-through")}>
              {quote.contextBefore}
              <span className={cn("px-0.5 rounded-sm bg-opacity-60", quote.status === "approved" ? "bg-green-200" : quote.status === "suggested" ? "bg-amber-200" : "bg-muted")}>
                {quote.exactText}
              </span>
              {quote.contextAfter}
            </p>
            {quote.justification && (
              <p className="mt-3 border-t border-border/60 pt-3 text-xs italic text-muted-foreground">
                {quote.justification}
              </p>
            )}
          </div>
        </div>

        {quote.status !== "rejected" && (
          <fieldset className="space-y-2 border-t border-border/60 pt-4">
            <legend className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              Link to insight
            </legend>
            {insightOptions.length === 0 ? (
              <p className="text-xs italic text-muted-foreground">
                No insights yet. Create one here to link this quote.
              </p>
            ) : (
              <ul className="max-h-60 space-y-0.5 overflow-y-auto pr-1">
                {insightOptions.map((option) => {
                  const link = quote.links.find((l) => l.insightId === option.id);
                  const isLinked = Boolean(link);
                  const isPrimary = link?.isPrimary ?? false;
                  return (
                    <li
                      key={option.id}
                      className="flex flex-col gap-1 rounded px-1.5 py-1.5 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isLinked}
                          onChange={(event) => {
                            if (event.target.checked) {
                              onLink(option.id, !hasPrimary);
                            } else {
                              onUnlink(option.id);
                            }
                          }}
                          disabled={busy}
                          className="h-3.5 w-3.5 accent-primary"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!isLinked || isPrimary) return;
                            onLink(option.id, true);
                          }}
                          disabled={busy || !isLinked}
                          className={cn(
                            "rounded text-sm leading-none transition-colors",
                            isPrimary ? "text-amber-500" : isLinked ? "text-muted-foreground hover:text-foreground" : "text-muted-foreground/30"
                          )}
                        >
                          {isPrimary ? "★" : "☆"}
                        </button>
                        <span className={cn("flex-1 text-sm cursor-pointer", !isLinked && "text-muted-foreground")} onClick={() => {
                          if (isLinked) onUnlink(option.id);
                          else onLink(option.id, !hasPrimary);
                        }}>
                          {option.label}
                        </span>
                      </div>
                      <div className={cn(
                        "grid transition-all duration-200 ease-in-out",
                        isLinked ? "grid-rows-[1fr] opacity-100 mt-1" : "grid-rows-[0fr] opacity-0 mt-0"
                      )}>
                        <div className="overflow-hidden">
                          <div className="flex flex-wrap gap-1.5 pl-8 pb-1">
                            {[
                              { v: "strong_match", label: "Strong" },
                              { v: "partial_support", label: "Partial" },
                              { v: "context", label: "Context" },
                              { v: "weak", label: "Weak" }
                            ].map(opt => (
                              <button
                                key={opt.v}
                                type="button"
                                onClick={() => onLink(option.id, isPrimary, link?.relevanceStrength === opt.v ? null : opt.v as any)}
                                className={cn(
                                  "px-2 py-0.5 text-[0.65rem] rounded-md border transition-colors",
                                  link?.relevanceStrength === opt.v
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-background text-muted-foreground border-border hover:bg-muted"
                                )}
                                disabled={busy}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="mt-2">
              <InlineNewInsight
                value={newInsightLabel}
                onChange={setNewInsightLabel}
                busy={busy}
                onCreate={() => {
                  void (async () => {
                    const created = await onCreateInsight(newInsightLabel);
                    if (!created) return;
                    setNewInsightLabel("");
                    await onLink(created.id, !quote.links.some((link) => link.isPrimary));
                  })();
                }}
              />
            </div>
          </fieldset>
        )}

        {quote.status === "suggested" && (
          <div className="space-y-3 border-t border-border/60 pt-4">
            {showReject ? (
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={rejectionReason}
                  onChange={(event) => setRejectionReason(event.target.value)}
                  placeholder="Why reject? (audit trail)"
                  className="h-8 min-w-0 flex-1 text-sm"
                  autoFocus
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await onReject(rejectionReason);
                    setShowReject(false);
                    setRejectionReason("");
                    onClose();
                  }}
                  disabled={busy || rejectionReason.trim().length === 0}
                >
                  Confirm
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowReject(false)} disabled={busy} className="text-muted-foreground">
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex flex-wrap gap-1">
                  {[
                    { value: "strong_match", label: "Strong" },
                    { value: "partial_support", label: "Partial" },
                    { value: "context", label: "Context" },
                    { value: "weak", label: "Weak" },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setApprovalRelevanceStrength(approvalRelevanceStrength === opt.value ? null : opt.value as any)}
                      className={cn(
                        "px-2 py-1 text-[0.65rem] rounded-md border transition-colors",
                        approvalRelevanceStrength === opt.value
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-muted-foreground border-border hover:bg-muted"
                      )}
                      disabled={busy}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <Button size="sm" onClick={async () => {
                  const primary = quote.links.find((l) => l.isPrimary);
                  await onApprove(primary?.insightId ?? null, [], approvalRelevanceStrength);
                }} disabled={busy}>Approve</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowReject(true)} disabled={busy} className="text-muted-foreground">Reject</Button>
              </div>
            )}
          </div>
        )}

        {quote.status === "rejected" && quote.rejectionReason && (
          <p className="border-t border-border/60 pt-3 text-xs text-muted-foreground">
            Reason: <span className="text-foreground/80">{quote.rejectionReason}</span>
          </p>
        )}
      </div>
    </div>
  );
}

interface QuoteRowProps {
  quote: QuoteRecord;
  insightOptions: InsightOption[];
  isFocused: boolean;
  onApprove: (primaryInsightId: string | null, additionalInsightIds: string[], relevanceStrength?: "strong_match" | "partial_support" | "context" | "weak" | null) => Promise<void>;
  onReject: (rejectionReason: string) => Promise<void>;
  onLink: (insightId: string, isPrimary: boolean, relevanceStrength?: "strong_match" | "partial_support" | "context" | "weak" | null) => Promise<void>;
  onUnlink: (insightId: string) => Promise<void>;
  onCreateInsight: (label: string) => Promise<InsightOption | null>;
  onFocus: (anchorRect: DOMRect | null) => void;
  busy: boolean;
}

function MetadataLine({ quote }: { quote: QuoteRecord }) {
  const parts: string[] = [];
  if (quote.speakerLabel) parts.push(quote.speakerLabel);
  if (quote.workGroupLabel) parts.push(quote.workGroupLabel);
  parts.push(quote.source === "ai" ? "AI suggested" : "Manual");
  if (quote.riskFlag) parts.push("Identifying-risk");

  return <p className="text-xs text-muted-foreground">{parts.join(" · ")}</p>;
}

function QuoteRow({
  quote,
  insightOptions,
  isFocused,
  onApprove,
  onReject,
  onCreateInsight,
  onUnlink,
  onFocus,
  busy,
}: QuoteRowProps) {
  const [showReject, setShowReject] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  return (
    <div
      onClick={(event) => onFocus(event.currentTarget.getBoundingClientRect())}
      className={cn(
        "cursor-pointer rounded-md border border-border bg-card p-3 transition-colors hover:border-border-s hover:bg-muted",
        isFocused && "ring-2 ring-ring"
      )}
    >
      <div className="mb-1.5 text-[0.6125rem] font-semibold uppercase tracking-widest text-muted-foreground">
        {quote.speakerLabel || "Unknown"}
      </div>
      <div className="mb-2 line-clamp-4 text-[0.8125rem] leading-relaxed text-muted-foreground">
        {quote.contextBefore}
        <span className={cn("px-0.5 rounded-sm bg-opacity-60 text-foreground", quote.status === "approved" ? "bg-green-200" : quote.status === "suggested" ? "bg-amber-200" : "bg-muted")}>
          {quote.exactText}
        </span>
        {quote.contextAfter}
      </div>
      {quote.justification && (
        <div className="mb-2 border-t border-border pt-1.5 text-xs italic text-muted-foreground">
          {quote.justification}
        </div>
      )}
      {quote.status === "suggested" && (
        <div className="flex gap-1.5 mt-2" onClick={(e) => e.stopPropagation()}>
          {showReject ? (
            <div className="flex w-full items-center gap-1">
              <Input
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Reason..."
                className="h-7 text-xs flex-1"
                autoFocus
              />
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => {
                onReject(rejectionReason);
                setShowReject(false);
              }}>✓</Button>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setShowReject(false)}>✕</Button>
            </div>
          ) : (
            <>
              <Button size="sm" className="h-7 px-2.5 text-xs" onClick={() => onApprove(null, [], null)} disabled={busy}>Approve</Button>
              <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs" onClick={() => setShowReject(true)} disabled={busy}>Reject</Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface QuoteListProps {
  status: QuoteStatus;
  quotes: QuoteRecord[];
  insightOptions: InsightOption[];
  focusedQuoteId: string | null;
  onFocus: (quoteId: string, anchorRect: DOMRect | null) => void;
  onApprove: (quoteId: string, primaryInsightId: string | null, additionalInsightIds: string[]) => Promise<void>;
  onReject: (quoteId: string, rejectionReason: string) => Promise<void>;
  onLink: (quoteId: string, insightId: string, isPrimary: boolean) => Promise<void>;
  onUnlink: (quoteId: string, insightId: string) => Promise<void>;
  onCreateInsight: (label: string) => Promise<InsightOption | null>;
  busy: boolean;
}

function QuoteList(props: QuoteListProps) {
  const { quotes, status } = props;
  if (quotes.length === 0) {
    return (
      <p className="px-4 py-6 text-sm text-muted-foreground">
        {status === "suggested"
          ? "No suggestions yet. Highlight transcript text to capture a quote."
          : status === "approved"
            ? "No approved quotes yet."
            : "No rejected quotes."}
      </p>
    );
  }
  return (
    <div>
      {quotes.map((quote) => (
        <QuoteRow
          key={quote.id}
          quote={quote}
          insightOptions={props.insightOptions}
          isFocused={props.focusedQuoteId === quote.id}
          busy={props.busy}
          onFocus={(rect) => props.onFocus(quote.id, rect)}
          onApprove={(primaryInsightId, additionalInsightIds) => props.onApprove(quote.id, primaryInsightId, additionalInsightIds)}
          onReject={(rejectionReason) => props.onReject(quote.id, rejectionReason)}
          onLink={(insightId, isPrimary) => props.onLink(quote.id, insightId, isPrimary)}
          onUnlink={(insightId) => props.onUnlink(quote.id, insightId)}
          onCreateInsight={props.onCreateInsight}
        />
      ))}
    </div>
  );
}

export function QuoteReviewPanel({ meetingId }: QuoteReviewPanelProps) {
  const meetingQuery = useMeeting(meetingId);
  const themesQuery = useMeetingThemes(meetingId);
  const quotesQuery = useMeetingQuotes(meetingId);
  const peopleQuery = useMeetingPeople(meetingId);

      const [viewMode, setViewMode] = useViewMode();
  const [tab, setTab] = useState<QuoteStatus>("suggested");
  const [searchQuery, setSearchQuery] = useState("");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [draftSelection, setDraftSelection] = useState<Selection | null>(null);
  const [focusedQuoteId, setFocusedQuoteId] = useState<string | null>(null);
  const [editingTarget, setEditingTarget] = useState<
    { quoteId: string; rect: DOMRect } | null
  >(null);
  const [isEditingSpanMode, setIsEditingSpanMode] = useState(false);

  const createQuote = useCreateQuote(meetingId);
  const createInsight = useCreateMeetingTheme(meetingId);
  const approveQuote = useApproveQuote(meetingId);
  const rejectQuote = useRejectQuote(meetingId);
  const linkInsight = useLinkQuoteInsight(meetingId);
  const unlinkInsight = useUnlinkQuoteInsight(meetingId);
  const updateSpeaker = useUpdateQuoteSpeaker(meetingId);
  const updateQuoteSpan = useUpdateQuoteSpan(meetingId);

  const transcript = meetingQuery.data?.meeting.transcript_raw ?? "";
  const quotes = useMemo(() => quotesQuery.data ?? [], [quotesQuery.data]);
  const themes = useMemo(() => themesQuery.data ?? [], [themesQuery.data]);
  const people = useMemo(() => peopleQuery.data ?? [], [peopleQuery.data]);

  const insightOptions = useMemo(
    () =>
      themes
        .filter((theme) => theme.accepted && !theme.rejected)
        .map((theme) => ({ id: theme.id, label: theme.label })),
    [themes]
  );

  const counts = useMemo(() => {
    const tally: Record<QuoteStatus, number> = { suggested: 0, approved: 0, rejected: 0 };
    for (const quote of quotes) tally[quote.status] += 1;
    return tally;
  }, [quotes]);

  const quotesByStatus = useMemo(() => {
    const buckets: Record<QuoteStatus, QuoteRecord[]> = {
      suggested: [],
      approved: [],
      rejected: [],
    };
    for (const quote of quotes) buckets[quote.status].push(quote);
    return buckets;
  }, [quotes]);

  const busy =
    createQuote.isPending ||
    createInsight.isPending ||
    approveQuote.isPending ||
    rejectQuote.isPending ||
    linkInsight.isPending ||
    unlinkInsight.isPending ||
    updateQuoteSpan.isPending;

  // Drop focus if the quote disappears (status change, deletion). Derived,
  // not state-synced — avoids the setState-in-effect anti-pattern.
  const effectiveFocusedQuoteId = useMemo(() => {
    if (!focusedQuoteId) return null;
    return quotes.some((quote) => quote.id === focusedQuoteId) ? focusedQuoteId : null;
  }, [focusedQuoteId, quotes]);

  // Live quote for the open EditQuoteTooltip; refetches automatically because
  // it reads from the same `quotes` cache. If the quote disappears the
  // tooltip auto-closes.
  const editingQuote = useMemo(() => {
    if (!editingTarget) return null;
    return quotes.find((quote) => quote.id === editingTarget.quoteId) ?? null;
  }, [editingTarget, quotes]);

  const handleSelectQuote = useCallback(
    (quoteId: string, anchorRect: DOMRect | null) => {
      setDraftSelection(null);
      setFocusedQuoteId(quoteId);
      setIsEditingSpanMode(false);
      // Only open the editor when the click came with an anchor rect (a real
      // click on the row or transcript span). null is used for programmatic
      // focus — e.g., setting focus after approve/capture.
      if (anchorRect) {
        setEditingTarget({ quoteId, rect: anchorRect });
      }
    },
    []
  );

    const handleInitDraft = useCallback(() => {
    if (!selection) return;
    setDraftSelection(selection);
    setSelection(null);
    setFocusedQuoteId(null);
  }, [selection]);

  const handleSaveDraft = useCallback(
    async ({
      speakerLabel,
      primaryInsightId,
      additionalInsightIds,
      relevanceStrengths,
    }: {
      speakerLabel: string;
      primaryInsightId: string | null;
      additionalInsightIds: string[];
      relevanceStrengths?: Record<string, "strong_match" | "partial_support" | "context" | "weak" | null>;
    }) => {
      if (!draftSelection) return;
      try {
        const created = await createQuote.mutateAsync({
          meetingId,
          spanStart: draftSelection.spanStart,
          spanEnd: draftSelection.spanEnd,
          exactText: draftSelection.text,
          speakerLabel: speakerLabel.trim() || null,
          source: "manual",
          riskFlag: false,
        });

        if (primaryInsightId) {
          await linkInsight.mutateAsync({ quoteId: created.id, insightId: primaryInsightId, isPrimary: true, relevanceStrength: relevanceStrengths?.[primaryInsightId] ?? null });
        }
        for (const iid of additionalInsightIds) {
          if (iid !== primaryInsightId) {
            await linkInsight.mutateAsync({ quoteId: created.id, insightId: iid, isPrimary: false, relevanceStrength: relevanceStrengths?.[iid] ?? null });
          }
        }

        toast.success("Quote saved");
        setDraftSelection(null);
        setFocusedQuoteId(created.id);
        
        setTimeout(() => {
          const span = document.querySelector(`span[data-quote-id="${created.id}"]`);
          if (span) {
            setEditingTarget({ quoteId: created.id, rect: span.getBoundingClientRect() });
          }
        }, 100);
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    },
    [createQuote, linkInsight, meetingId, draftSelection]
  );

  const handleCreateInsight = useCallback(
    async (label: string): Promise<InsightOption | null> => {
      const trimmed = label.trim();
      if (!trimmed) return null;
      try {
        const created = await createInsight.mutateAsync({ label: trimmed });
        await themesQuery.refetch();
        toast.success("Insight created");
        return { id: created.id, label: trimmed };
      } catch (error) {
        toast.error(getErrorMessage(error));
        return null;
      }
    },
    [createInsight, themesQuery]
  );

  const onApprove = useCallback(
    async (quoteId: string, primaryInsightId: string | null, additionalInsightIds: string[] = [], relevanceStrength?: "strong_match" | "partial_support" | "context" | "weak" | null) => {
      try {
        await approveQuote.mutateAsync({ quoteId, primaryInsightId, additionalInsightIds, relevanceStrength: relevanceStrength ?? null });
        toast.success("Quote approved");
        setFocusedQuoteId(quoteId);
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    },
    [approveQuote]
  );

  const onReject = useCallback(
    async (quoteId: string, rejectionReason: string) => {
      try {
        await rejectQuote.mutateAsync({ quoteId, rejectionReason });
        toast.success("Quote rejected");
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    },
    [rejectQuote]
  );

  const onLink = useCallback(
    async (quoteId: string, insightId: string, isPrimary: boolean, relevanceStrength?: "strong_match" | "partial_support" | "context" | "weak" | null) => {
      try {
        await linkInsight.mutateAsync({ quoteId, insightId, isPrimary, relevanceStrength: relevanceStrength ?? null });
        toast.success("Insight linked");
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    },
    [linkInsight]
  );

  const handleUpdateSpan = useCallback(async (newSelection: Selection) => {
    if (!editingTarget) return;
    try {
      await updateQuoteSpan.mutateAsync({
        quoteId: editingTarget.quoteId,
        spanStart: newSelection.spanStart,
        spanEnd: newSelection.spanEnd,
        exactText: newSelection.text,
      });
      toast.success("Quote region updated");
      setSelection(null);
      setIsEditingSpanMode(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }, [updateQuoteSpan, editingTarget]);

  const onUnlink = useCallback(
    async (quoteId: string, insightId: string) => {
      try {
        await unlinkInsight.mutateAsync({ quoteId, insightId });
        toast.success("Insight unlinked");
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    },
    [unlinkInsight]
  );

  const onChangeSpeaker = useCallback(
    async (quoteId: string, speakerLabel: string | null) => {
      try {
        await updateSpeaker.mutateAsync({ quoteId, speakerLabel });
        toast.success("Speaker updated");
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    },
    [updateSpeaker]
  );

  if (meetingQuery.isPending || quotesQuery.isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!transcript) {
    return (
      <p className="text-sm text-muted-foreground">
        Quote review opens once the transcript is captured.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "flex flex-wrap items-end justify-between gap-3",
          viewMode === "compact" && "mx-auto w-full max-w-3xl"
        )}
      >
        <p className="max-w-prose text-sm text-muted-foreground">
          Highlight transcript text to capture a quote — the action floats next to your selection. Click any quote to jump to its source span.
        </p>
        <ViewModeToggle value={viewMode} onChange={setViewMode} />
      </div>

      {viewMode === "workspace" ? (
        <WorkspaceLayout
          transcript={transcript}
          quotes={quotes}
          quotesByStatus={quotesByStatus}
          counts={counts}
          insightOptions={insightOptions}
          focusedQuoteId={effectiveFocusedQuoteId}
          busy={busy}
          onSelection={setSelection}
          onSpanFocus={handleSelectQuote}
          onApprove={onApprove}
          onReject={onReject}
          onLink={onLink}
          onUnlink={onUnlink}
          onChangeSpeaker={onChangeSpeaker}
          onCreateInsight={handleCreateInsight}
          tab={tab}
          onTabChange={setTab}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
                    onCloseDetail={() => setFocusedQuoteId(null)}
          editingQuote={editingQuote}
          draftSelection={draftSelection}
          onCloseDraft={() => setDraftSelection(null)}
          onSaveDraft={handleSaveDraft}
          people={people}
          isEditingSpanMode={isEditingSpanMode}
          onSetEditingSpanMode={setIsEditingSpanMode}
          currentSelection={selection}
          onUpdateSpan={handleUpdateSpan}
        />
      ) : (
        <CompactLayout
          transcript={transcript}
          quotes={quotes}
          counts={counts}
          insightOptions={insightOptions}
          focusedQuoteId={effectiveFocusedQuoteId}
          tab={tab}
          onTabChange={setTab}
          busy={busy}
          onSelection={setSelection}
          onSpanFocus={handleSelectQuote}
          onApprove={onApprove}
          onReject={onReject}
          onLink={onLink}
          onUnlink={onUnlink}
          onChangeSpeaker={onChangeSpeaker}
          onCreateInsight={handleCreateInsight}
          quotesByStatus={quotesByStatus}
          people={people}
        />
      )}

      {selection && !isEditingSpanMode && (
        <SelectionTooltip
          selection={selection}
          onCapture={handleInitDraft}
          onDismiss={() => setSelection(null)}
          busy={busy}
        />
      )}

    </div>
  );
}

function ViewModeToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (next: ViewMode) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Quote review layout"
      className="inline-flex items-center gap-0.5 rounded-md border border-border/60 bg-background p-0.5"
    >
      <button
        type="button"
        onClick={() => onChange("compact")}
        aria-pressed={value === "compact"}
        title="Stacked view"
        className={cn(
          "inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors",
          value === "compact"
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Rows3 className="size-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">Stacked</span>
      </button>
      <button
        type="button"
        onClick={() => onChange("workspace")}
        aria-pressed={value === "workspace"}
        title="Split workspace"
        className={cn(
          "inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors",
          value === "workspace"
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Columns2 className="size-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">Split</span>
      </button>
    </div>
  );
}

function CreateDraftPane({
  selection,
  transcript,
  people,
  insightOptions,
  busy,
  onClose,
  onSave,
  onCreateInsight,
}: {
  selection: Selection;
  insightOptions: InsightOption[];
  busy: boolean;
  onClose: () => void;
  onSave: (params: { speakerLabel: string; primaryInsightId: string | null; additionalInsightIds: string[]; relevanceStrengths?: Record<string, "strong_match" | "partial_support" | "context" | "weak" | null>; }) => Promise<void>;
  onCreateInsight: (label: string) => Promise<InsightOption | null>;
  transcript: string;
  people: Person[];
}) {
  const [speakerLabel, setSpeakerLabel] = useState("");
  const [checkedInsightIds, setCheckedInsightIds] = useState<Set<string>>(new Set());
  const [primaryInsightId, setPrimaryInsightId] = useState<string | null>(null);
  const [newInsightLabel, setNewInsightLabel] = useState("");
  const [relevanceStrengths, setRelevanceStrengths] = useState<Record<string, "strong_match" | "partial_support" | "context" | "weak" | null>>({});

  const contextBefore = transcript.slice(Math.max(0, selection.spanStart - 80), selection.spanStart);
  const contextAfter = transcript.slice(selection.spanEnd, selection.spanEnd + 80);

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border/60 p-4">
        <div>
          <span className="text-xs uppercase tracking-widest font-semibold text-foreground">
            New Quote
          </span>
        </div>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 leading-none">×</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <p className="text-sm italic leading-relaxed text-foreground">
            <span className="opacity-50">{contextBefore}</span>
            <span className="px-0.5 rounded-sm bg-muted bg-opacity-60">
              {selection.text}
            </span>
            <span className="opacity-50">{contextAfter}</span>
          </p>
        </div>

        <div className="space-y-1 pt-2">
          <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Speaker</label>
          <select 
            value={speakerLabel} 
            onChange={(e) => setSpeakerLabel(e.target.value)} 
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            disabled={busy}
          >
            <option value="" disabled>Select a speaker...</option>
            {people.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
            <option value="Anonymous">Anonymous</option>
            <option value="Moderator/Facilitator">Moderator/Facilitator</option>
          </select>
          <p className="text-[0.65rem] text-muted-foreground mt-1">If the person is missing, add them to the meeting details at the top of the page.</p>
        </div>

        <fieldset className="space-y-2 border-t border-border/60 pt-4">
          <legend className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            Link to insight
          </legend>
          {insightOptions.length === 0 ? (
            <p className="text-xs italic text-muted-foreground">No insights yet. Create one here to link this quote.</p>
          ) : (
            <ul className="max-h-60 space-y-0.5 overflow-y-auto pr-1">
              {insightOptions.map((option) => {
                const isChecked = checkedInsightIds.has(option.id);
                const isPrimary = primaryInsightId === option.id;
                return (
                  <li key={option.id} className="flex flex-col gap-1 rounded px-1.5 py-1.5 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(event) => {
                          const next = new Set(checkedInsightIds);
                          if (event.target.checked) {
                            next.add(option.id);
                          } else {
                            next.delete(option.id);
                            if (isPrimary) setPrimaryInsightId(null);
                          }
                          setCheckedInsightIds(next);
                        }}
                        disabled={busy}
                        className="h-3.5 w-3.5 accent-primary"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!isChecked) return;
                          setPrimaryInsightId(isPrimary ? null : option.id);
                        }}
                        disabled={busy || !isChecked}
                        className={cn(
                          "rounded text-sm leading-none transition-colors",
                          isPrimary ? "text-primary" : isChecked ? "text-muted-foreground hover:text-foreground" : "text-muted-foreground/30"
                        )}
                      >
                        {isPrimary ? "★" : "☆"}
                      </button>
                      <span className={cn("flex-1 text-sm cursor-pointer", !isChecked && "text-muted-foreground")} onClick={() => {
                        const next = new Set(checkedInsightIds);
                        if (isChecked) {
                          next.delete(option.id);
                          if (isPrimary) setPrimaryInsightId(null);
                        } else {
                          next.add(option.id);
                        }
                        setCheckedInsightIds(next);
                      }}>
                        {option.label}
                      </span>
                    </div>
                    <div className={cn(
                      "grid transition-all duration-200 ease-in-out",
                      isChecked ? "grid-rows-[1fr] opacity-100 mt-1" : "grid-rows-[0fr] opacity-0 mt-0"
                    )}>
                      <div className="overflow-hidden">
                        <div className="flex flex-wrap gap-1.5 pl-8 pb-1">
                          {[
                            { v: "strong_match", label: "Strong" },
                            { v: "partial_support", label: "Partial" },
                            { v: "context", label: "Context" },
                            { v: "weak", label: "Weak" }
                          ].map(opt => (
                            <button
                              key={opt.v}
                              type="button"
                              onClick={() => setRelevanceStrengths(prev => ({ ...prev, [option.id]: prev[option.id] === opt.v ? null : opt.v as any }))}
                              className={cn(
                                "px-2 py-0.5 text-[0.65rem] rounded-md border transition-colors",
                                relevanceStrengths[option.id] === opt.v
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-background text-muted-foreground border-border hover:bg-muted"
                              )}
                              disabled={busy}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-2">
            <InlineNewInsight
              value={newInsightLabel}
              onChange={setNewInsightLabel}
              busy={busy}
              onCreate={() => {
                void (async () => {
                  const created = await onCreateInsight(newInsightLabel);
                  if (!created) return;
                  setNewInsightLabel("");
                  setCheckedInsightIds((current) => new Set(current).add(created.id));
                  setPrimaryInsightId((current) => current ?? created.id);
                })();
              }}
            />
          </div>
        </fieldset>

        <div className="flex items-center gap-2 pt-4 border-t border-border/60">
          <Button size="sm" onClick={() => onSave({ speakerLabel, primaryInsightId, additionalInsightIds: Array.from(checkedInsightIds).filter(id => id !== primaryInsightId), relevanceStrengths })} disabled={busy || speakerLabel.trim().length === 0}>Save</Button>
          <Button size="sm" variant="ghost" onClick={onClose} disabled={busy} className="text-muted-foreground">Cancel</Button>
        </div>
      </div>
    </div>
  );
}

interface LayoutBaseProps {
  transcript: string;
  quotes: QuoteRecord[];
  counts: Record<QuoteStatus, number>;
  insightOptions: InsightOption[];
  focusedQuoteId: string | null;
  busy: boolean;
  onSelection: (selection: Selection | null) => void;
  onSpanFocus: (quoteId: string, anchorRect: DOMRect | null) => void;
  onApprove: (quoteId: string, primaryInsightId: string | null, additionalInsightIds: string[], relevanceStrength?: "strong_match" | "partial_support" | "context" | "weak" | null) => Promise<void>;
  onReject: (quoteId: string, rejectionReason: string) => Promise<void>;
  onLink: (quoteId: string, insightId: string, isPrimary: boolean, relevanceStrength?: "strong_match" | "partial_support" | "context" | "weak" | null) => Promise<void>;
  onUnlink: (quoteId: string, insightId: string) => Promise<void>;
  onChangeSpeaker: (quoteId: string, speakerLabel: string | null) => Promise<void>;
  onCreateInsight: (label: string) => Promise<InsightOption | null>;
  quotesByStatus: Record<QuoteStatus, QuoteRecord[]>;
  people: Person[];
}

function WorkspaceLayout(props: LayoutBaseProps & {
  tab: QuoteStatus;
  onTabChange: (tab: QuoteStatus) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onCloseDetail: () => void;
  editingQuote: QuoteRecord | null;
  draftSelection: Selection | null;
  onCloseDraft: () => void;
  onSaveDraft: (params: { speakerLabel: string; primaryInsightId: string | null; additionalInsightIds: string[]; relevanceStrengths?: Record<string, "strong_match" | "partial_support" | "context" | "weak" | null> }) => Promise<void>;
  isEditingSpanMode: boolean;
  onSetEditingSpanMode: (mode: boolean) => void;
  currentSelection: Selection | null;
  onUpdateSpan: (selection: Selection) => Promise<void>;
}) {
  const visibleQuotes = props.quotesByStatus[props.tab].filter(q => 
    !props.searchQuery || 
    q.exactText.toLowerCase().includes(props.searchQuery.toLowerCase()) || 
    q.speakerLabel?.toLowerCase().includes(props.searchQuery.toLowerCase())
  );

  return (
    <div className="grid min-h-[520px] grid-cols-1 gap-4 overflow-hidden lg:h-[calc(100vh-14rem)] lg:min-h-0 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)]">
      <TranscriptPane
        transcript={props.transcript}
        quotes={props.quotes}
        focusedQuoteId={props.focusedQuoteId}
        onSelection={props.onSelection}
        onSpanFocus={props.onSpanFocus}
      />
      <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border/60 bg-card">
        {props.draftSelection ? (
          <CreateDraftPane
            selection={props.draftSelection}
            transcript={props.transcript}
            people={props.people}
            insightOptions={props.insightOptions}
            busy={props.busy}
            onClose={props.onCloseDraft}
            onSave={props.onSaveDraft}
            onCreateInsight={props.onCreateInsight}
          />
        ) : props.focusedQuoteId && props.editingQuote ? (
          <DetailViewPane
            quote={props.editingQuote}
            insightOptions={props.insightOptions}
            busy={props.busy}
            onClose={props.onCloseDetail}
            onApprove={(pid, aids, rs) => props.onApprove(props.editingQuote!.id, pid, aids, rs)}
            onReject={(reason) => props.onReject(props.editingQuote!.id, reason)}
            onLink={(iid, isPri, rs) => props.onLink(props.editingQuote!.id, iid, isPri, rs)}
            onUnlink={(iid) => props.onUnlink(props.editingQuote!.id, iid)}
            onChangeSpeaker={(speakerLabel) => props.onChangeSpeaker(props.editingQuote!.id, speakerLabel)}
            onCreateInsight={props.onCreateInsight}
            people={props.people}
            isEditingSpanMode={props.isEditingSpanMode}
            onSetEditingSpanMode={props.onSetEditingSpanMode}
            currentSelection={props.currentSelection}
            onUpdateSpan={props.onUpdateSpan}
          />
        ) : (
          <div className="flex h-full flex-col">
            <div className="border-b border-border/60 px-2 pt-2">
              <nav className="flex items-end gap-1 overflow-x-auto">
                {STATUS_ORDER.map((value) => {
                  const isActive = props.tab === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => props.onTabChange(value)}
                      className={cn(
                        "flex items-center gap-1.5 border-b-2 px-3 pb-2 text-xs font-medium transition-colors",
                        isActive
                          ? "border-primary text-foreground"
                          : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                      )}
                    >
                      {STATUS_LABEL[value]}
                      <span className={cn("rounded px-1.5 py-0.5 text-[0.6875rem] leading-none", 
                        value === "suggested" && props.counts[value] > 0 ? "bg-amber-200/40 text-amber-900" :
                        value === "approved" && props.counts[value] > 0 ? "bg-green-200/40 text-green-900" :
                        value === "rejected" && props.counts[value] > 0 ? "bg-muted text-muted-foreground" :
                        "bg-muted text-muted-foreground"
                      )}>
                        {props.counts[value]}
                      </span>
                    </button>
                  );
                })}
              </nav>
            </div>
            <div className="border-b border-border/60 px-3 py-2">
              <input
                type="search"
                value={props.searchQuery}
                onChange={(e) => props.onSearchChange(e.target.value)}
                placeholder="Filter by speaker or quote text..."
                className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <div className="flex flex-col gap-2">
                {visibleQuotes.length === 0 ? (
                  <p className="text-xs italic text-muted-foreground py-2">No quotes found.</p>
                ) : (
                  visibleQuotes.map(quote => (
                    <QuoteRow
                      key={quote.id}
                      quote={quote}
                      insightOptions={props.insightOptions}
                      isFocused={props.focusedQuoteId === quote.id}
                      busy={props.busy}
                      onFocus={(rect) => props.onSpanFocus(quote.id, rect)}
                      onApprove={(pid, aids, rs) => props.onApprove(quote.id, pid, aids, rs)}
                      onReject={(reason) => props.onReject(quote.id, reason)}
                      onLink={(iid, isPri, rs) => props.onLink(quote.id, iid, isPri, rs)}
                      onUnlink={(iid) => props.onUnlink(quote.id, iid)}
                      onCreateInsight={props.onCreateInsight}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


interface CompactLayoutProps extends LayoutBaseProps {
  tab: QuoteStatus;
  onTabChange: (tab: QuoteStatus) => void;
}

function CompactLayout(props: CompactLayoutProps) {
  const visibleQuotes = props.quotesByStatus[props.tab];
  return (
    <div className="scroll-zone mx-auto w-full max-w-3xl space-y-4 rounded-lg border border-border/60 bg-card hover:border-border/90">
      <div className="border-b border-border/60 px-4 pt-3">
        <nav
          className="flex items-end gap-5"
          role="tablist"
          aria-label="Quote review status"
        >
          {STATUS_ORDER.map((value) => {
            const isActive = props.tab === value;
            return (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => props.onTabChange(value)}
                className={cn(
                  "-mb-px border-b-2 pb-2 text-sm font-medium transition-colors",
                  isActive
                    ? "border-foreground/70 text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                )}
              >
                {STATUS_LABEL[value]}
                <span className="ml-1.5 text-xs text-muted-foreground">{props.counts[value]}</span>
              </button>
            );
          })}
        </nav>
      </div>
      <div className="max-h-[60vh] overflow-y-auto px-4 pb-2">
        <TranscriptReadout
          transcript={props.transcript}
          quotes={props.quotes}
          focusedQuoteId={props.focusedQuoteId}
          onSelection={props.onSelection}
          onSpanClick={(quoteId, rect) => props.onSpanFocus(quoteId, rect)}
        />
      </div>
      <div className="max-h-[40vh] overflow-y-auto border-t border-border/60">
        <QuoteList
          status={props.tab}
          quotes={visibleQuotes}
          insightOptions={props.insightOptions}
          focusedQuoteId={props.focusedQuoteId}
          onFocus={props.onSpanFocus}
          onApprove={props.onApprove}
          onReject={props.onReject}
          onLink={props.onLink}
          onUnlink={props.onUnlink}
          onCreateInsight={props.onCreateInsight}
          busy={props.busy}
        />
      </div>
    </div>
  );
}

function TranscriptPane({
  transcript,
  quotes,
  focusedQuoteId,
  onSelection,
  onSpanFocus,
}: {
  transcript: string;
  quotes: QuoteRecord[];
  focusedQuoteId: string | null;
  onSelection: (selection: Selection | null) => void;
  onSpanFocus: (quoteId: string, anchorRect: DOMRect | null) => void;
}) {
  return (
    <section
      aria-label="Transcript"
      className="scroll-zone flex max-h-[70vh] min-h-0 flex-col overflow-hidden rounded-lg border border-border/60 bg-card hover:border-border/90 lg:max-h-none"
    >
      <header className="shrink-0 border-b border-border/60 px-4 py-2.5">
        <div className="flex items-baseline gap-3">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Transcript
          </span>
          <span className="text-xs text-muted-foreground">
            {transcript.length.toLocaleString()} chars · highlight to capture
          </span>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <TranscriptReadout
          transcript={transcript}
          quotes={quotes}
          focusedQuoteId={focusedQuoteId}
          onSelection={onSelection}
          onSpanClick={(quoteId, rect) => onSpanFocus(quoteId, rect)}
        />
      </div>
    </section>
  );
}

interface ListPaneProps {
  title: string;
  count: number;
  status: QuoteStatus;
  quotes: QuoteRecord[];
  insightOptions: InsightOption[];
  focusedQuoteId: string | null;
  busy: boolean;
  onFocus: (quoteId: string, anchorRect: DOMRect | null) => void;
  onApprove: (quoteId: string, primaryInsightId: string | null, additionalInsightIds: string[]) => Promise<void>;
  onReject: (quoteId: string, rejectionReason: string) => Promise<void>;
  onLink: (quoteId: string, insightId: string, isPrimary: boolean) => Promise<void>;
  onUnlink: (quoteId: string, insightId: string) => Promise<void>;
  onCreateInsight: (label: string) => Promise<InsightOption | null>;
  rejectedCount?: number;
  outerClassName?: string;
}

function ListPane({
  title,
  count,
  status,
  quotes,
  insightOptions,
  focusedQuoteId,
  busy,
  onFocus,
  onApprove,
  onReject,
  onLink,
  onUnlink,
  onCreateInsight,
  rejectedCount,
  outerClassName,
}: ListPaneProps) {
  return (
    <section
      aria-label={title}
      className={cn(
        "scroll-zone flex max-h-[70vh] min-h-[160px] flex-col overflow-hidden rounded-lg border border-border/60 bg-card hover:border-border/90 lg:max-h-none lg:min-h-0",
        outerClassName
      )}
    >
      <header className="flex shrink-0 items-baseline justify-between gap-3 border-b border-border/60 px-4 py-2.5">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {title}
          </span>
          <span className="text-xs text-muted-foreground">{count}</span>
        </div>
        {typeof rejectedCount === "number" && rejectedCount > 0 && (
          <span className="text-xs text-muted-foreground">
            {rejectedCount} rejected
          </span>
        )}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <QuoteList
          status={status}
          quotes={quotes}
          insightOptions={insightOptions}
          focusedQuoteId={focusedQuoteId}
          onFocus={onFocus}
          onApprove={onApprove}
          onReject={onReject}
          onLink={onLink}
          onUnlink={onUnlink}
          onCreateInsight={onCreateInsight}
          busy={busy}
        />
      </div>
    </section>
  );
}
