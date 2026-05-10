import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import type { QuoteRecord, QuoteStatus } from "@/lib/actions/quotes";
import type { ReportQuoteLibraryQuote } from "@/lib/report-quote-library";
import {
  approveQuote,
  createQuote,
  ingestAIQuoteSuggestions,
  linkQuoteToInsight,
  rejectQuote,
  unlinkQuoteFromInsight,
} from "@/lib/actions/quotes";
import { fetchJson } from "@/hooks/api";

const QUOTE_KEY = ["quotes"] as const;

export function quoteKeysForMeeting(meetingId: string, status: QuoteStatus | "all" = "all") {
  return [...QUOTE_KEY, "meeting", meetingId, status] as const;
}

export function useMeetingQuotes(
  meetingId: string,
  options: { status?: QuoteStatus | "all"; enabled?: boolean } = {}
) {
  const status = options.status ?? "all";
  return useQuery({
    queryKey: quoteKeysForMeeting(meetingId, status),
    queryFn: () =>
      fetchJson<QuoteRecord[]>(
        `/api/client/quotes/meeting/${meetingId}?status=${encodeURIComponent(status)}`
      ),
    enabled: options.enabled ?? Boolean(meetingId),
  });
}

export function useApprovedQuotesForMeetings(
  meetings: Array<{ id: string; title: string }>,
  options: { enabled?: boolean } = {}
) {
  const enabled = options.enabled ?? true;
  const results = useQueries({
    queries: meetings.map((meeting) => ({
      queryKey: quoteKeysForMeeting(meeting.id, "approved"),
      queryFn: () =>
        fetchJson<QuoteRecord[]>(
          `/api/client/quotes/meeting/${meeting.id}?status=approved`
        ),
      enabled: enabled && Boolean(meeting.id),
    })),
  });

  const quotes = results.flatMap((result, index): ReportQuoteLibraryQuote[] => {
    const meeting = meetings[index];
    return (result.data ?? []).map((quote) => ({
      ...quote,
      meetingTitle: meeting?.title ?? "Untitled meeting",
    }));
  });

  return {
    quotes,
    isLoading: results.some((result) => result.isLoading),
    isError: results.some((result) => result.isError),
    error: results.find((result) => result.error)?.error ?? null,
  };
}

function invalidateMeetingQuotes(qc: ReturnType<typeof useQueryClient>, meetingId: string) {
  qc.invalidateQueries({ queryKey: [...QUOTE_KEY, "meeting", meetingId] });
}

export function useCreateQuote(meetingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: Parameters<typeof createQuote>[0]) => createQuote(params),
    onSuccess: () => invalidateMeetingQuotes(qc, meetingId),
  });
}

export function useApproveQuote(meetingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: Parameters<typeof approveQuote>[0]) => approveQuote(params),
    onSuccess: () => invalidateMeetingQuotes(qc, meetingId),
  });
}

export function useRejectQuote(meetingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: Parameters<typeof rejectQuote>[0]) => rejectQuote(params),
    onSuccess: () => invalidateMeetingQuotes(qc, meetingId),
  });
}

export function useLinkQuoteInsight(meetingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: Parameters<typeof linkQuoteToInsight>[0]) =>
      linkQuoteToInsight(params),
    onSuccess: () => invalidateMeetingQuotes(qc, meetingId),
  });
}

export function useUnlinkQuoteInsight(meetingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: Parameters<typeof unlinkQuoteFromInsight>[0]) =>
      unlinkQuoteFromInsight(params),
    onSuccess: () => invalidateMeetingQuotes(qc, meetingId),
  });
}

export function useIngestAIQuoteSuggestions(meetingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (suggestions: Parameters<typeof ingestAIQuoteSuggestions>[1]) =>
      ingestAIQuoteSuggestions(meetingId, suggestions),
    onSuccess: () => invalidateMeetingQuotes(qc, meetingId),
  });
}
