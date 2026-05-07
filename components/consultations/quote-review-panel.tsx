"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

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

type Selection = { spanStart: number; spanEnd: number; text: string };

const STATUS_LABEL: Record<QuoteStatus, string> = {
  suggested: "Suggested",
  approved: "Approved",
  rejected: "Rejected",
};

const STATUS_ORDER: QuoteStatus[] = ["suggested", "approved", "rejected"];

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return "Something went wrong. Please try again.";
}

/**
 * Read-only transcript that highlights approved + suggested quote spans and
 * captures manual selections with exact offsets into meetings.transcript_raw.
 *
 * Visual rule: status earns weight. Suggested = warm warning tint (needs
 * review). Approved = quiet brand tint (settled). Rejected isn't rendered.
 */
function TranscriptReadout({
  transcript,
  quotes,
  onSelection,
}: {
  transcript: string;
  quotes: QuoteRecord[];
  onSelection: (selection: Selection | null) => void;
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
    const preRange = range.cloneRange();
    preRange.selectNodeContents(node);
    preRange.setEnd(range.startContainer, range.startOffset);
    const spanStart = preRange.toString().length;
    const text = range.toString();
    if (!text.trim()) {
      onSelection(null);
      return;
    }
    onSelection({ spanStart, spanEnd: spanStart + text.length, text });
  }, [onSelection]);

  return (
    <div
      ref={containerRef}
      onMouseUp={handleMouseUp}
      className="max-w-prose whitespace-pre-wrap rounded-md border border-border/60 bg-background/60 p-4 text-[0.9375rem] leading-7 text-foreground/90 selection:bg-primary/20"
      data-testid="quote-review-transcript"
    >
      {segments.map((segment) =>
        segment.quote ? (
          <mark
            key={segment.key}
            data-quote-id={segment.quote.id}
            data-quote-status={segment.quote.status}
            className={cn(
              "rounded-sm px-0.5",
              segment.quote.status === "approved"
                ? "bg-primary/10 text-foreground"
                : "bg-amber-200/60 text-foreground dark:bg-amber-300/20"
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

interface QuoteRowProps {
  quote: QuoteRecord;
  insightOptions: Array<{ id: string; label: string }>;
  onApprove: (primaryInsightId: string | null) => Promise<void>;
  onReject: (rejectionReason: string) => Promise<void>;
  onLink: (insightId: string, isPrimary: boolean) => Promise<void>;
  onUnlink: (insightId: string) => Promise<void>;
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
  onApprove,
  onReject,
  onLink,
  onUnlink,
  busy,
}: QuoteRowProps) {
  const [primaryInsightId, setPrimaryInsightId] = useState("");
  const [linkInsightId, setLinkInsightId] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const primaryLink = quote.links.find((link) => link.isPrimary);
  const otherLinks = quote.links.filter((link) => !link.isPrimary);

  return (
    <article className="space-y-3 border-t border-border/60 py-5 first:border-t-0 first:pt-0">
      <blockquote className="text-[0.9375rem] italic leading-relaxed text-foreground">
        “{quote.exactText}”
      </blockquote>

      <MetadataLine quote={quote} />

      {primaryLink && (
        <p className="text-xs text-muted-foreground">
          Linked to <span className="text-foreground">{primaryLink.insightLabel}</span>
          {otherLinks.length > 0 && (
            <>
              {" "}
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                className="underline-offset-2 hover:underline"
              >
                +{otherLinks.length} more
              </button>
            </>
          )}
        </p>
      )}

      {expanded && otherLinks.length > 0 && (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {otherLinks.map((link) => (
            <li key={link.insightId} className="flex items-center justify-between gap-3">
              <span className="text-foreground">{link.insightLabel}</span>
              <button
                type="button"
                onClick={() => onUnlink(link.insightId)}
                disabled={busy}
                className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
              >
                Unlink
              </button>
            </li>
          ))}
        </ul>
      )}

      {quote.status === "suggested" && !showReject && (
        <div className="flex flex-wrap items-center gap-2">
          {insightOptions.length > 0 && (
            <select
              value={primaryInsightId}
              onChange={(event) => setPrimaryInsightId(event.target.value)}
              disabled={busy}
              aria-label="Link to insight on approval"
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="">Approve without insight link</option>
              {insightOptions.map((option) => (
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
        <div className="flex flex-wrap items-center gap-2">
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

      {quote.status === "approved" && insightOptions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={linkInsightId}
            onChange={(event) => setLinkInsightId(event.target.value)}
            disabled={busy}
            aria-label="Link an additional insight"
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="">Link another insight…</option>
            {insightOptions
              .filter((option) => !quote.links.some((link) => link.insightId === option.id))
              .map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
          </select>
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              if (!linkInsightId) return;
              await onLink(linkInsightId, !primaryLink);
              setLinkInsightId("");
            }}
            disabled={busy || !linkInsightId}
            className="text-muted-foreground"
          >
            {primaryLink ? "Add link" : "Link as primary"}
          </Button>
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

function CaptureBar({
  selection,
  onCapture,
  onDismiss,
  busy,
}: {
  selection: Selection;
  onCapture: (riskFlag: boolean, speakerHint: string) => void | Promise<void>;
  onDismiss: () => void;
  busy: boolean;
}) {
  const [riskFlag, setRiskFlag] = useState(false);
  const [speakerHint, setSpeakerHint] = useState("");

  return (
    <div className="space-y-3 rounded-md border border-border/60 bg-muted/30 p-4">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Captured selection · {selection.text.length} chars
        </p>
        <p className="text-sm italic leading-relaxed text-foreground">
          “{selection.text.length > 240 ? `${selection.text.slice(0, 240)}…` : selection.text}”
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Input
          value={speakerHint}
          onChange={(event) => setSpeakerHint(event.target.value)}
          placeholder="Speaker (optional)"
          className="h-8 max-w-[14rem] text-sm"
        />
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={riskFlag}
            onChange={(event) => setRiskFlag(event.target.checked)}
            className="h-3.5 w-3.5 accent-primary"
          />
          Identifying-content risk
        </label>
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => onCapture(riskFlag, speakerHint)} disabled={busy}>
          Capture quote
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDismiss}
          disabled={busy}
          className="text-muted-foreground"
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
}

export function QuoteReviewPanel({ meetingId }: QuoteReviewPanelProps) {
  const meetingQuery = useMeeting(meetingId);
  const themesQuery = useMeetingThemes(meetingId);
  const quotesQuery = useMeetingQuotes(meetingId);

  const [tab, setTab] = useState<QuoteStatus>("suggested");
  const [selection, setSelection] = useState<Selection | null>(null);

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

  const visibleQuotes = useMemo(
    () => quotes.filter((quote) => quote.status === tab),
    [quotes, tab]
  );

  const busy =
    createQuote.isPending ||
    approveQuote.isPending ||
    rejectQuote.isPending ||
    linkInsight.isPending ||
    unlinkInsight.isPending;

  const handleCapture = useCallback(
    async (riskFlag: boolean, speakerHint: string) => {
      if (!selection) return;
      try {
        await createQuote.mutateAsync({
          meetingId,
          spanStart: selection.spanStart,
          spanEnd: selection.spanEnd,
          exactText: selection.text,
          speakerLabel: speakerHint.trim() || null,
          source: "manual",
          riskFlag,
        });
        toast.success("Quote captured");
        setSelection(null);
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    },
    [createQuote, meetingId, selection]
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
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Review suggested quotes against the transcript. Approved quotes feed insight evidence and report drafts. Selecting any text below captures a manual quote with exact offsets.
      </p>

      <TranscriptReadout transcript={transcript} quotes={quotes} onSelection={setSelection} />

      {selection && (
        <CaptureBar
          selection={selection}
          onCapture={handleCapture}
          onDismiss={() => setSelection(null)}
          busy={busy}
        />
      )}

      <div className="flex items-end justify-between gap-4 border-b border-border/60">
        <nav className="flex items-end gap-5" aria-label="Quote review status filter">
          {STATUS_ORDER.map((value) => {
            const isActive = tab === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={cn(
                  "-mb-px border-b-2 pb-2 text-sm font-medium transition-colors",
                  isActive
                    ? "border-foreground/70 text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {STATUS_LABEL[value]}
                <span className="ml-1.5 text-xs text-muted-foreground">{counts[value]}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div>
        {quotesQuery.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : visibleQuotes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {tab === "suggested"
              ? "No suggestions yet. Capture a quote by selecting transcript text above."
              : tab === "approved"
                ? "No approved quotes yet."
                : "No rejected quotes."}
          </p>
        ) : (
          <div>
            {visibleQuotes.map((quote) => (
              <QuoteRow
                key={quote.id}
                quote={quote}
                insightOptions={insightOptions}
                busy={busy}
                onApprove={async (primaryInsightId) => {
                  try {
                    await approveQuote.mutateAsync({
                      quoteId: quote.id,
                      primaryInsightId,
                    });
                    toast.success("Quote approved");
                  } catch (error) {
                    toast.error(getErrorMessage(error));
                  }
                }}
                onReject={async (rejectionReason) => {
                  try {
                    await rejectQuote.mutateAsync({
                      quoteId: quote.id,
                      rejectionReason,
                    });
                    toast.success("Quote rejected");
                  } catch (error) {
                    toast.error(getErrorMessage(error));
                  }
                }}
                onLink={async (insightId, isPrimary) => {
                  try {
                    await linkInsight.mutateAsync({
                      quoteId: quote.id,
                      insightId,
                      isPrimary,
                    });
                    toast.success("Insight linked");
                  } catch (error) {
                    toast.error(getErrorMessage(error));
                  }
                }}
                onUnlink={async (insightId) => {
                  try {
                    await unlinkInsight.mutateAsync({
                      quoteId: quote.id,
                      insightId,
                    });
                    toast.success("Insight unlinked");
                  } catch (error) {
                    toast.error(getErrorMessage(error));
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
