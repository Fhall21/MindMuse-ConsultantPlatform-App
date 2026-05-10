import type { QuoteRecord, QuoteSource } from "@/lib/actions/quotes";
import type { RenderedQuote } from "@/lib/quote-render";

export type QuoteGroupMode = "meeting" | "insight" | "workgroup";
export type QuoteSourceFilter = "all" | QuoteSource;

export interface ReportQuoteLibraryQuote extends QuoteRecord {
  meetingTitle: string;
}

export interface ReportQuoteFilters {
  search: string;
  source: QuoteSourceFilter;
  groupBy: QuoteGroupMode;
}

export interface ReportQuoteGroup {
  key: string;
  label: string;
  quotes: ReportQuoteLibraryQuote[];
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

export function quoteMatchesReportFilters(
  quote: ReportQuoteLibraryQuote,
  filters: Pick<ReportQuoteFilters, "search" | "source">
) {
  if (filters.source !== "all" && quote.source !== filters.source) {
    return false;
  }

  const search = normalizeSearch(filters.search);
  if (!search) return true;

  const haystack = [
    quote.exactText,
    quote.speakerLabel,
    quote.workGroupLabel,
    quote.meetingTitle,
    quote.source,
    ...quote.links.map((link) => link.insightLabel),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(search);
}

function groupKeysForQuote(quote: ReportQuoteLibraryQuote, groupBy: QuoteGroupMode) {
  if (groupBy === "meeting") {
    return [{ key: quote.meetingId, label: quote.meetingTitle }];
  }

  if (groupBy === "workgroup") {
    return [
      {
        key: quote.workGroupLabel ?? "uncategorized-workgroup",
        label: quote.workGroupLabel ?? "No work group",
      },
    ];
  }

  if (quote.links.length === 0) {
    return [{ key: "unlinked-insight", label: "No linked insight" }];
  }

  return quote.links.map((link) => ({
    key: link.insightId,
    label: link.insightLabel,
  }));
}

export function groupReportQuotes(
  quotes: ReportQuoteLibraryQuote[],
  filters: ReportQuoteFilters
): ReportQuoteGroup[] {
  const groups = new Map<string, ReportQuoteGroup>();

  for (const quote of quotes) {
    if (!quoteMatchesReportFilters(quote, filters)) continue;

    for (const groupKey of groupKeysForQuote(quote, filters.groupBy)) {
      const existing = groups.get(groupKey.key);
      if (existing) {
        existing.quotes.push(quote);
      } else {
        groups.set(groupKey.key, {
          key: groupKey.key,
          label: groupKey.label,
          quotes: [quote],
        });
      }
    }
  }

  return Array.from(groups.values()).sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: "base" })
  );
}

function blockquote(text: string) {
  return text
    .trim()
    .split(/\n+/)
    .map((line) => `> ${line.trim()}`)
    .join("\n>\n");
}

export function formatQuoteInsertionMarkdown(
  quote: ReportQuoteLibraryQuote,
  rendered: RenderedQuote,
  labels: { meetingTitle?: string; insightLabels?: string[] } = {}
) {
  const insightLabels = labels.insightLabels ?? quote.links.map((link) => link.insightLabel);
  const metadata = [
    rendered.attribution ? `Source: ${rendered.attribution}` : null,
    `Meeting: ${labels.meetingTitle ?? quote.meetingTitle}`,
    insightLabels.length > 0
      ? `Insight${insightLabels.length === 1 ? "" : "s"}: ${insightLabels.join(", ")}`
      : null,
    rendered.masked ? "Masked for anonymous mode" : null,
    rendered.riskFlagged ? "Review before external sharing" : null,
  ].filter(Boolean);

  return `${blockquote(rendered.text)}\n\n_${metadata.join(" | ")}_`;
}

export function quoteRequiresAnonymousRiskConfirmation(
  rendered: Pick<RenderedQuote, "riskFlagged">,
  anonymousMode: boolean
) {
  return anonymousMode && rendered.riskFlagged;
}
