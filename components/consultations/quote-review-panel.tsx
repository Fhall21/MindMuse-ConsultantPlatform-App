"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { Columns2, Rows3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useMeeting } from "@/hooks/use-meetings";
import { useMeetingThemes } from "@/hooks/use-themes";
import {
  useApproveQuote,
  useCreateQuote,
  useLinkQuoteInsight,
  useMeetingQuotes,
  useRejectQuote,
  useUnlinkQuoteInsight,
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

type ViewMode = "workspace" | "compact";

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

/**
 * View-mode preference that persists in localStorage. Defaults to compact —
 * the wider workspace layout is opt-in so people who prefer the stacked
 * vertical flow are not surprised on first visit.
 */
function useViewMode(): [ViewMode, (mode: ViewMode) => void] {
  const [mode, setMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "compact";
    const stored = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    return stored === "workspace" || stored === "compact" ? stored : "compact";
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
  onSpanClick: (quoteId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  const segments = useMemo(() => {
    if (!transcript) {
      return [{ text: "", quote: null as QuoteRecord | null, key: "empty" }];
    }
    const ordered = quotes
      .filter((quote) => quote.status !== "rejected")
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
      `mark[data-quote-id="${focusedQuoteId}"]`
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
          <mark
            key={segment.key}
            data-quote-id={segment.quote.id}
            data-quote-status={segment.quote.status}
            onClick={() => onSpanClick(segment.quote!.id)}
            className={cn(
              "cursor-pointer rounded-sm px-0.5 transition-shadow",
              segment.quote.status === "approved"
                ? "bg-primary/10 text-foreground"
                : "bg-amber-200/60 text-foreground dark:bg-amber-300/20",
              focusedQuoteId === segment.quote.id &&
                "ring-2 ring-foreground/40 ring-offset-1 ring-offset-card"
            )}
          >
            {segment.text}
          </mark>
        ) : (
          <span key={segment.key}>{segment.text}</span>
        )
      )}
    </div>
  );
}

interface SelectionTooltipProps {
  selection: Selection;
  insightOptions: Array<{ id: string; label: string }>;
  onCapture: (params: {
    speakerHint: string;
    riskFlag: boolean;
    insightId: string | null;
  }) => Promise<void>;
  onDismiss: () => void;
  busy: boolean;
}

/**
 * Floating capture form anchored to the user's selection. The form lives in
 * a fixed-position popover so the action is always next to the highlighted
 * text — no scrolling to find a save button. Clicks outside dismiss; the
 * speaker / risk / insight controls live inside one row.
 */
function SelectionTooltip({
  selection,
  insightOptions,
  onCapture,
  onDismiss,
  busy,
}: SelectionTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [speakerHint, setSpeakerHint] = useState("");
  const [riskFlag, setRiskFlag] = useState(false);
  const [insightId, setInsightId] = useState("");

  // Position once the tooltip has rendered and we know its size.
  useLayoutEffect(() => {
    const node = tooltipRef.current;
    if (!node) return;
    const tooltipRect = node.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 12;

    // Horizontal: centre under selection, clamp to viewport.
    const desiredLeft = selection.rect.left + selection.rect.width / 2 - tooltipRect.width / 2;
    const left = Math.max(
      margin,
      Math.min(desiredLeft, viewportWidth - tooltipRect.width - margin)
    );

    // Vertical: prefer below; flip above if it would overflow.
    let top = selection.rect.bottom + 8;
    if (top + tooltipRect.height + margin > viewportHeight) {
      top = selection.rect.top - tooltipRect.height - 8;
    }
    if (top < margin) top = margin;

    setPosition({ top, left });
  }, [selection.rect]);

  // Dismiss on Escape, scroll, or outside click.
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onDismiss();
    }
    function handlePointer(event: MouseEvent) {
      if (!tooltipRef.current) return;
      if (tooltipRef.current.contains(event.target as Node)) return;
      // Don't dismiss while the user is still selecting more text.
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
      style={position ?? { visibility: "hidden" }}
      className={cn(
        "fixed z-40 w-[min(28rem,calc(100vw-1.5rem))] space-y-3 rounded-lg border border-border/60 bg-popover p-3 text-popover-foreground shadow-md",
        position == null && "pointer-events-none"
      )}
    >
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Selection · {selection.text.length} chars
        </p>
        <p className="line-clamp-2 text-sm italic leading-snug text-foreground">
          “{selection.text.length > 180 ? `${selection.text.slice(0, 180)}…` : selection.text}”
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          value={speakerHint}
          onChange={(event) => setSpeakerHint(event.target.value)}
          placeholder="Speaker (optional)"
          className="h-8 text-sm"
        />
        {insightOptions.length > 0 && (
          <select
            value={insightId}
            onChange={(event) => setInsightId(event.target.value)}
            disabled={busy}
            aria-label="Link to insight"
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="">Link to insight (optional)</option>
            {insightOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={riskFlag}
            onChange={(event) => setRiskFlag(event.target.checked)}
            className="h-3.5 w-3.5 accent-primary"
          />
          Identifying-content risk
        </label>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={onDismiss}
            disabled={busy}
            className="text-muted-foreground"
          >
            Dismiss
          </Button>
          <Button
            size="sm"
            onClick={() =>
              onCapture({
                speakerHint,
                riskFlag,
                insightId: insightId || null,
              })
            }
            disabled={busy}
          >
            Capture
          </Button>
        </div>
      </div>
    </div>
  );
}

interface QuoteRowProps {
  quote: QuoteRecord;
  insightOptions: Array<{ id: string; label: string }>;
  isFocused: boolean;
  onApprove: (primaryInsightId: string | null) => Promise<void>;
  onReject: (rejectionReason: string) => Promise<void>;
  onLink: (insightId: string, isPrimary: boolean) => Promise<void>;
  onUnlink: (insightId: string) => Promise<void>;
  onFocus: () => void;
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
  onLink,
  onUnlink,
  onFocus,
  busy,
}: QuoteRowProps) {
  const [primaryInsightId, setPrimaryInsightId] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [showReject, setShowReject] = useState(false);

  const primaryLink = quote.links.find((link) => link.isPrimary);
  const otherLinks = quote.links.filter((link) => !link.isPrimary);

  // Insights that aren't yet linked to this quote — what the user could add.
  const linkableInsights = useMemo(
    () => insightOptions.filter((option) => !quote.links.some((link) => link.insightId === option.id)),
    [insightOptions, quote.links]
  );

  return (
    <article
      onClick={onFocus}
      className={cn(
        "group cursor-pointer space-y-3 border-t border-border/60 px-4 py-4 transition-colors first:border-t-0",
        isFocused ? "bg-muted/40" : "hover:bg-muted/20"
      )}
    >
      <blockquote className="text-[0.9375rem] italic leading-relaxed text-foreground">
        “{quote.exactText}”
      </blockquote>

      <MetadataLine quote={quote} />

      {/* Linked insights as chips */}
      {quote.links.length > 0 && (
        <ul className="flex flex-wrap items-center gap-1.5">
          {primaryLink && (
            <li
              key={primaryLink.insightId}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-xs text-foreground"
              title="Primary insight"
            >
              <span aria-hidden="true" className="size-1.5 rounded-full bg-primary/70" />
              {primaryLink.insightLabel}
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onUnlink(primaryLink.insightId);
                }}
                disabled={busy}
                aria-label={`Unlink ${primaryLink.insightLabel}`}
                className="text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                ×
              </button>
            </li>
          )}
          {otherLinks.map((link) => (
            <li
              key={link.insightId}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background px-2 py-0.5 text-xs text-foreground"
            >
              {link.insightLabel}
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onUnlink(link.insightId);
                }}
                disabled={busy}
                aria-label={`Unlink ${link.insightLabel}`}
                className="text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Suggested actions: Approve / Reject (audit-required rationale). */}
      {quote.status === "suggested" && !showReject && (
        <div
          className="flex flex-wrap items-center gap-2"
          onClick={(event) => event.stopPropagation()}
        >
          {linkableInsights.length > 0 && (
            <select
              value={primaryInsightId}
              onChange={(event) => setPrimaryInsightId(event.target.value)}
              disabled={busy}
              aria-label="Link to insight on approval"
              className="h-8 max-w-full rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="">Link to insight (optional)</option>
              {linkableInsights.map((option) => (
                <option key={option.id} value={option.id}>
                  Link to {option.label}
                </option>
              ))}
            </select>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => onApprove(primaryInsightId || null)}
            disabled={busy}
          >
            Approve
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowReject(true)}
            disabled={busy}
            className="text-muted-foreground"
          >
            Reject
          </Button>
        </div>
      )}

      {quote.status === "suggested" && showReject && (
        <div
          className="flex flex-wrap items-center gap-2"
          onClick={(event) => event.stopPropagation()}
        >
          <Input
            value={rejectionReason}
            onChange={(event) => setRejectionReason(event.target.value)}
            placeholder="Why reject this quote? (audit trail)"
            className="h-8 max-w-md text-sm"
            autoFocus
          />
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              await onReject(rejectionReason);
              setRejectionReason("");
              setShowReject(false);
            }}
            disabled={busy || rejectionReason.trim().length === 0}
          >
            Confirm reject
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setShowReject(false);
              setRejectionReason("");
            }}
            disabled={busy}
            className="text-muted-foreground"
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Approved row: pick from remaining insights and link in one gesture. */}
      {quote.status === "approved" && linkableInsights.length > 0 && (
        <div onClick={(event) => event.stopPropagation()}>
          <select
            value=""
            onChange={async (event) => {
              const insightId = event.target.value;
              if (!insightId) return;
              await onLink(insightId, !primaryLink);
            }}
            disabled={busy}
            aria-label={primaryLink ? "Add another insight" : "Link primary insight"}
            className="h-8 max-w-full rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="">
              {primaryLink ? "Add another insight…" : "Link primary insight…"}
            </option>
            {linkableInsights.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {quote.status === "rejected" && quote.rejectionReason && (
        <p className="text-xs text-muted-foreground">
          Reason: <span className="text-foreground/80">{quote.rejectionReason}</span>
        </p>
      )}
    </article>
  );
}

interface QuoteListProps {
  status: QuoteStatus;
  quotes: QuoteRecord[];
  insightOptions: Array<{ id: string; label: string }>;
  focusedQuoteId: string | null;
  onFocus: (quoteId: string) => void;
  onApprove: (quoteId: string, primaryInsightId: string | null) => Promise<void>;
  onReject: (quoteId: string, rejectionReason: string) => Promise<void>;
  onLink: (quoteId: string, insightId: string, isPrimary: boolean) => Promise<void>;
  onUnlink: (quoteId: string, insightId: string) => Promise<void>;
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
          onFocus={() => props.onFocus(quote.id)}
          onApprove={(primaryInsightId) => props.onApprove(quote.id, primaryInsightId)}
          onReject={(rejectionReason) => props.onReject(quote.id, rejectionReason)}
          onLink={(insightId, isPrimary) => props.onLink(quote.id, insightId, isPrimary)}
          onUnlink={(insightId) => props.onUnlink(quote.id, insightId)}
        />
      ))}
    </div>
  );
}

export function QuoteReviewPanel({ meetingId }: QuoteReviewPanelProps) {
  const meetingQuery = useMeeting(meetingId);
  const themesQuery = useMeetingThemes(meetingId);
  const quotesQuery = useMeetingQuotes(meetingId);

  const [viewMode, setViewMode] = useViewMode();
  const [tab, setTab] = useState<QuoteStatus>("suggested");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [focusedQuoteId, setFocusedQuoteId] = useState<string | null>(null);

  const createQuote = useCreateQuote(meetingId);
  const approveQuote = useApproveQuote(meetingId);
  const rejectQuote = useRejectQuote(meetingId);
  const linkInsight = useLinkQuoteInsight(meetingId);
  const unlinkInsight = useUnlinkQuoteInsight(meetingId);

  const transcript = meetingQuery.data?.meeting.transcript_raw ?? "";
  const quotes = useMemo(() => quotesQuery.data ?? [], [quotesQuery.data]);
  const themes = useMemo(() => themesQuery.data ?? [], [themesQuery.data]);

  const insightOptions = useMemo(
    () =>
      themes
        .filter((theme) => !theme.rejected)
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
    approveQuote.isPending ||
    rejectQuote.isPending ||
    linkInsight.isPending ||
    unlinkInsight.isPending;

  // Drop focus if the quote disappears (status change, deletion). Derived,
  // not state-synced — avoids the setState-in-effect anti-pattern.
  const effectiveFocusedQuoteId = useMemo(() => {
    if (!focusedQuoteId) return null;
    return quotes.some((quote) => quote.id === focusedQuoteId) ? focusedQuoteId : null;
  }, [focusedQuoteId, quotes]);

  const handleCapture = useCallback(
    async ({
      speakerHint,
      riskFlag,
      insightId,
    }: {
      speakerHint: string;
      riskFlag: boolean;
      insightId: string | null;
    }) => {
      if (!selection) return;
      try {
        const created = await createQuote.mutateAsync({
          meetingId,
          spanStart: selection.spanStart,
          spanEnd: selection.spanEnd,
          exactText: selection.text,
          speakerLabel: speakerHint.trim() || null,
          source: "manual",
          riskFlag,
        });
        if (insightId) {
          // Manual capture auto-approves; link as primary if no primary yet.
          await linkInsight.mutateAsync({
            quoteId: created.id,
            insightId,
            isPrimary: created.links.length === 0,
          });
        }
        toast.success(insightId ? "Quote captured and linked" : "Quote captured");
        setSelection(null);
        setFocusedQuoteId(created.id);
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    },
    [createQuote, linkInsight, meetingId, selection]
  );

  const onApprove = useCallback(
    async (quoteId: string, primaryInsightId: string | null) => {
      try {
        await approveQuote.mutateAsync({ quoteId, primaryInsightId });
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
    async (quoteId: string, insightId: string, isPrimary: boolean) => {
      try {
        await linkInsight.mutateAsync({ quoteId, insightId, isPrimary });
        toast.success("Insight linked");
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    },
    [linkInsight]
  );

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

  if (meetingQuery.isLoading) {
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
          onSpanFocus={setFocusedQuoteId}
          onApprove={onApprove}
          onReject={onReject}
          onLink={onLink}
          onUnlink={onUnlink}
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
          onSpanFocus={setFocusedQuoteId}
          onApprove={onApprove}
          onReject={onReject}
          onLink={onLink}
          onUnlink={onUnlink}
          quotesByStatus={quotesByStatus}
        />
      )}

      {selection && (
        <SelectionTooltip
          selection={selection}
          insightOptions={insightOptions}
          onCapture={handleCapture}
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

interface LayoutBaseProps {
  transcript: string;
  quotes: QuoteRecord[];
  counts: Record<QuoteStatus, number>;
  insightOptions: Array<{ id: string; label: string }>;
  focusedQuoteId: string | null;
  busy: boolean;
  onSelection: (selection: Selection | null) => void;
  onSpanFocus: (quoteId: string) => void;
  onApprove: (quoteId: string, primaryInsightId: string | null) => Promise<void>;
  onReject: (quoteId: string, rejectionReason: string) => Promise<void>;
  onLink: (quoteId: string, insightId: string, isPrimary: boolean) => Promise<void>;
  onUnlink: (quoteId: string, insightId: string) => Promise<void>;
  quotesByStatus: Record<QuoteStatus, QuoteRecord[]>;
}

function WorkspaceLayout(props: LayoutBaseProps) {
  return (
    <div className="grid min-h-[480px] grid-cols-1 gap-4 lg:h-[calc(100vh-14rem)] lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <TranscriptPane
        transcript={props.transcript}
        quotes={props.quotes}
        focusedQuoteId={props.focusedQuoteId}
        onSelection={props.onSelection}
        onSpanFocus={props.onSpanFocus}
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-rows-2">
        <ListPane
          title="Suggested"
          count={props.counts.suggested}
          status="suggested"
          quotes={props.quotesByStatus.suggested}
          insightOptions={props.insightOptions}
          focusedQuoteId={props.focusedQuoteId}
          busy={props.busy}
          onFocus={props.onSpanFocus}
          onApprove={props.onApprove}
          onReject={props.onReject}
          onLink={props.onLink}
          onUnlink={props.onUnlink}
        />
        <ListPane
          title="Approved"
          count={props.counts.approved}
          status="approved"
          quotes={props.quotesByStatus.approved}
          insightOptions={props.insightOptions}
          focusedQuoteId={props.focusedQuoteId}
          busy={props.busy}
          onFocus={props.onSpanFocus}
          onApprove={props.onApprove}
          onReject={props.onReject}
          onLink={props.onLink}
          onUnlink={props.onUnlink}
          rejectedCount={props.counts.rejected}
        />
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
    <div className="mx-auto w-full max-w-3xl space-y-4 rounded-lg border border-border/60 bg-card">
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
          onSpanClick={props.onSpanFocus}
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
  onSpanFocus: (quoteId: string) => void;
}) {
  return (
    <section
      aria-label="Transcript"
      className="flex max-h-[70vh] flex-col overflow-hidden rounded-lg border border-border/60 bg-card lg:max-h-none"
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
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <TranscriptReadout
          transcript={transcript}
          quotes={quotes}
          focusedQuoteId={focusedQuoteId}
          onSelection={onSelection}
          onSpanClick={onSpanFocus}
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
  insightOptions: Array<{ id: string; label: string }>;
  focusedQuoteId: string | null;
  busy: boolean;
  onFocus: (quoteId: string) => void;
  onApprove: (quoteId: string, primaryInsightId: string | null) => Promise<void>;
  onReject: (quoteId: string, rejectionReason: string) => Promise<void>;
  onLink: (quoteId: string, insightId: string, isPrimary: boolean) => Promise<void>;
  onUnlink: (quoteId: string, insightId: string) => Promise<void>;
  rejectedCount?: number;
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
  rejectedCount,
}: ListPaneProps) {
  return (
    <section
      aria-label={title}
      className="flex max-h-[70vh] min-h-[180px] flex-col overflow-hidden rounded-lg border border-border/60 bg-card lg:max-h-none"
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
      <div className="flex-1 overflow-y-auto">
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
          busy={busy}
        />
      </div>
    </section>
  );
}
