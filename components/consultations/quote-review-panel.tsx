"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

type TabValue = QuoteStatus;

const STATUS_LABEL: Record<QuoteStatus, string> = {
  suggested: "Suggested",
  approved: "Approved",
  rejected: "Rejected",
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return "Something went wrong. Please try again.";
}

/**
 * Renders the meeting transcript with approved + suggested quote spans
 * highlighted. Manual quote capture is supported via text selection: select
 * any range and the captured selection is offered for approval.
 */
function TranscriptWithSpans({
  transcript,
  quotes,
  onSelection,
}: {
  transcript: string;
  quotes: QuoteRecord[];
  onSelection: (selection: { spanStart: number; spanEnd: number; text: string } | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  const segments = useMemo(() => {
    if (!transcript) return [{ text: "", quote: null as QuoteRecord | null, key: "empty" }];

    const ordered = quotes
      .filter((quote) => quote.status !== "rejected")
      .slice()
      .sort((a, b) => a.spanStart - b.spanStart);

    const slices: Array<{ text: string; quote: QuoteRecord | null; key: string }> = [];
    let cursor = 0;
    let idx = 0;
    for (const quote of ordered) {
      if (quote.spanStart < cursor) continue; // skip overlapping quote slices
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
      slices.push({
        text: transcript.slice(cursor),
        quote: null,
        key: `plain-tail`,
      });
    }
    return slices;
  }, [transcript, quotes]);

  const handleMouseUp = useCallback(() => {
    const node = containerRef.current;
    if (!node) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      onSelection(null);
      return;
    }
    if (selection.rangeCount === 0) {
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
      className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap rounded-md border bg-card p-4 text-sm leading-relaxed"
    >
      {segments.map((segment) =>
        segment.quote ? (
          <mark
            key={segment.key}
            data-quote-id={segment.quote.id}
            className={cn(
              "rounded px-0.5",
              segment.quote.status === "approved"
                ? "bg-emerald-200/70 dark:bg-emerald-900/40"
                : "bg-amber-200/70 dark:bg-amber-900/40"
            )}
            title={segment.quote.status === "approved" ? "Approved quote" : "Suggested quote"}
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

interface QuoteCardProps {
  quote: QuoteRecord;
  insightOptions: Array<{ id: string; label: string }>;
  onApprove: (primaryInsightId: string | null) => void | Promise<void>;
  onReject: (rejectionReason: string) => void | Promise<void>;
  onLink: (insightId: string, isPrimary: boolean) => void | Promise<void>;
  onUnlink: (insightId: string) => void | Promise<void>;
  busy: boolean;
}

function QuoteCard({
  quote,
  insightOptions,
  onApprove,
  onReject,
  onLink,
  onUnlink,
  busy,
}: QuoteCardProps) {
  const [primaryInsightId, setPrimaryInsightId] = useState<string>("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [showReject, setShowReject] = useState(false);

  const primaryLink = quote.links.find((link) => link.isPrimary);
  const otherLinks = quote.links.filter((link) => !link.isPrimary);

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <blockquote className="border-l-4 border-primary/40 pl-3 text-sm italic">
          {quote.exactText}
        </blockquote>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {quote.speakerLabel && <Badge variant="secondary">{quote.speakerLabel}</Badge>}
          {quote.workGroupLabel && <Badge variant="outline">{quote.workGroupLabel}</Badge>}
          <Badge variant="outline">{quote.source === "ai" ? "AI" : "Manual"}</Badge>
          {quote.riskFlag && (
            <Badge variant="destructive" title={quote.riskReason ?? undefined}>
              Risk
            </Badge>
          )}
        </div>

        {primaryLink && (
          <div className="text-xs">
            <span className="font-medium">Primary insight:</span> {primaryLink.insightLabel}
          </div>
        )}
        {otherLinks.length > 0 && (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground">
              {otherLinks.length} other linked insight{otherLinks.length === 1 ? "" : "s"}
            </summary>
            <ul className="mt-2 space-y-1">
              {otherLinks.map((link) => (
                <li key={link.insightId} className="flex items-center justify-between gap-2">
                  <span>{link.insightLabel}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onUnlink(link.insightId)}
                    disabled={busy}
                  >
                    Unlink
                  </Button>
                </li>
              ))}
            </ul>
          </details>
        )}

        {quote.status === "suggested" && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="flex h-8 rounded-md border bg-background px-2 text-xs"
                value={primaryInsightId}
                onChange={(event) => setPrimaryInsightId(event.target.value)}
                disabled={busy || insightOptions.length === 0}
              >
                <option value="">No insight (link later)</option>
                {insightOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                onClick={() => onApprove(primaryInsightId || null)}
                disabled={busy}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowReject((prev) => !prev)}
                disabled={busy}
              >
                Reject
              </Button>
            </div>
            {showReject && (
              <div className="flex flex-col gap-2">
                <Textarea
                  placeholder="Why are you rejecting this quote? (required for audit)"
                  value={rejectionReason}
                  onChange={(event) => setRejectionReason(event.target.value)}
                  rows={2}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => onReject(rejectionReason)}
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
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {quote.status === "approved" && insightOptions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">Add insight link:</span>
            <select
              className="flex h-8 rounded-md border bg-background px-2 text-xs"
              value={primaryInsightId}
              onChange={(event) => setPrimaryInsightId(event.target.value)}
              disabled={busy}
            >
              <option value="">Select…</option>
              {insightOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (primaryInsightId) {
                  onLink(primaryInsightId, !primaryLink);
                }
              }}
              disabled={busy || !primaryInsightId}
            >
              {primaryLink ? "Link" : "Link as primary"}
            </Button>
          </div>
        )}

        {quote.status === "rejected" && quote.rejectionReason && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Reason:</span> {quote.rejectionReason}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function QuoteReviewPanel({ meetingId }: QuoteReviewPanelProps) {
  const meetingQuery = useMeeting(meetingId);
  const themesQuery = useMeetingThemes(meetingId);
  const quotesQuery = useMeetingQuotes(meetingId);

  const [tab, setTab] = useState<TabValue>("suggested");
  const [pendingSelection, setPendingSelection] = useState<
    { spanStart: number; spanEnd: number; text: string } | null
  >(null);
  const [manualPersonHint, setManualPersonHint] = useState("");
  const [manualRiskFlag, setManualRiskFlag] = useState(false);

  const createQuote = useCreateQuote(meetingId);
  const approveQuote = useApproveQuote(meetingId);
  const rejectQuote = useRejectQuote(meetingId);
  const linkInsight = useLinkQuoteInsight(meetingId);
  const unlinkInsight = useUnlinkQuoteInsight(meetingId);

  const transcript = meetingQuery.data?.meeting.transcript_raw ?? "";
  const quotes = quotesQuery.data ?? [];
  const themes = themesQuery.data ?? [];

  const insightOptions = useMemo(
    () =>
      themes
        .filter((theme) => !theme.rejected)
        .map((theme) => ({ id: theme.id, label: theme.label })),
    [themes]
  );

  const counts = useMemo(() => {
    const tally: Record<QuoteStatus, number> = {
      suggested: 0,
      approved: 0,
      rejected: 0,
    };
    for (const quote of quotes) {
      tally[quote.status] += 1;
    }
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

  useEffect(() => {
    setPendingSelection(null);
  }, [tab]);

  const handleManualCapture = useCallback(async () => {
    if (!pendingSelection) return;
    try {
      await createQuote.mutateAsync({
        meetingId,
        spanStart: pendingSelection.spanStart,
        spanEnd: pendingSelection.spanEnd,
        exactText: pendingSelection.text,
        speakerLabel: manualPersonHint.trim() || null,
        source: "manual",
        riskFlag: manualRiskFlag,
      });
      toast.success("Quote captured");
      setPendingSelection(null);
      setManualPersonHint("");
      setManualRiskFlag(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }, [createQuote, manualPersonHint, manualRiskFlag, meetingId, pendingSelection]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
      <section className="space-y-3">
        <header className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Transcript</h3>
          <p className="text-xs text-muted-foreground">
            Select text to capture a manual quote.
          </p>
        </header>
        {meetingQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading transcript…</p>
        ) : transcript ? (
          <TranscriptWithSpans
            transcript={transcript}
            quotes={quotes}
            onSelection={setPendingSelection}
          />
        ) : (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            No transcript available yet. Quote review unlocks once transcript capture is complete.
          </p>
        )}
        {pendingSelection && (
          <Card>
            <CardContent className="space-y-3 p-4">
              <p className="text-sm font-medium">Capture as quote</p>
              <blockquote className="border-l-4 border-primary/40 pl-3 text-sm italic">
                {pendingSelection.text}
              </blockquote>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  placeholder="Speaker name (optional)"
                  value={manualPersonHint}
                  onChange={(event) => setManualPersonHint(event.target.value)}
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={manualRiskFlag}
                    onChange={(event) => setManualRiskFlag(event.target.checked)}
                  />
                  Flag identifying-content risk
                </label>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleManualCapture} disabled={busy} size="sm">
                  Capture quote
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPendingSelection(null)}
                  disabled={busy}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex w-full gap-2 border-b">
          {(["suggested", "approved", "rejected"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                tab === value
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {STATUS_LABEL[value]}
              <span className="rounded bg-muted px-1.5 text-xs">{counts[value]}</span>
            </button>
          ))}
        </div>
        <div className="space-y-3">
          {quotesQuery.isLoading && (
            <p className="text-sm text-muted-foreground">Loading quotes…</p>
          )}
          {!quotesQuery.isLoading && visibleQuotes.length === 0 && (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              {tab === "suggested"
                ? "No suggestions yet. Run the AI suggestion pass or capture a quote manually."
                : tab === "approved"
                  ? "No approved quotes yet."
                  : "No rejected quotes."}
            </p>
          )}
          {visibleQuotes.map((quote) => (
              <QuoteCard
                key={quote.id}
                quote={quote}
                insightOptions={insightOptions}
                busy={busy}
                onApprove={async (primaryInsightId) => {
                  try {
                    await approveQuote.mutateAsync({
                      quoteId: quote.id,
                      primaryInsightId: primaryInsightId,
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
      </section>
    </div>
  );
}
