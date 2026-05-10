"use client";

import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useApprovedQuotesForMeetings } from "@/hooks/use-quotes";
import {
  formatQuoteInsertionMarkdown,
  groupReportQuotes,
  type QuoteGroupMode,
  type QuoteSourceFilter,
} from "@/lib/report-quote-library";
import { renderQuote } from "@/lib/quote-render";
import type { ReportRenderPolicy } from "@/lib/report-render-policy";
import type { ConsultationMeta } from "@/types/report-artifact";
import { cn } from "@/lib/utils";

interface ReportQuoteLibraryProps {
  consultations: ConsultationMeta[];
  renderPolicy: ReportRenderPolicy;
  onInsertMarkdown: (markdown: string) => void;
}

const GROUP_LABELS: Record<QuoteGroupMode, string> = {
  meeting: "Meeting",
  insight: "Insight",
  workgroup: "Work group",
};

export function ReportQuoteLibrary({
  consultations,
  renderPolicy,
  onInsertMarkdown,
}: ReportQuoteLibraryProps) {
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<QuoteSourceFilter>("all");
  const [groupBy, setGroupBy] = useState<QuoteGroupMode>("insight");
  const meetings = useMemo(
    () => consultations.map((meeting) => ({ id: meeting.id, title: meeting.title })),
    [consultations]
  );
  const { quotes, isLoading, isError } = useApprovedQuotesForMeetings(meetings, {
    enabled: meetings.length > 0,
  });
  const groups = useMemo(
    () => groupReportQuotes(quotes, { search, source, groupBy }),
    [groupBy, quotes, search, source]
  );
  const visibleCount = groups.reduce((sum, group) => sum + group.quotes.length, 0);

  return (
    <aside
      className="flex min-h-[60vh] flex-col rounded-lg border border-border bg-muted/20"
      aria-label="Approved quote library"
    >
      <div className="space-y-3 border-b border-border/70 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Quote library</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Approved evidence from this report&apos;s meetings.
            </p>
          </div>
          <Badge variant="outline" className="shrink-0 text-[11px]">
            {visibleCount}
          </Badge>
        </div>

        <label className="relative block">
          <span className="sr-only">Search approved quotes</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search quotes, speakers, insights"
            className="h-9 pl-9 text-sm"
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <Select value={groupBy} onValueChange={(value) => setGroupBy(value as QuoteGroupMode)}>
            <SelectTrigger className="h-9 text-xs" aria-label="Group quotes by">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="insight">By insight</SelectItem>
              <SelectItem value="meeting">By meeting</SelectItem>
              <SelectItem value="workgroup">By work group</SelectItem>
            </SelectContent>
          </Select>

          <Select value={source} onValueChange={(value) => setSource(value as QuoteSourceFilter)}>
            <SelectTrigger className="h-9 text-xs" aria-label="Filter quotes by source">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              <SelectItem value="ai">AI suggested</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : isError ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            Quotes could not load. Save your edit, then reopen the report.
          </p>
        ) : groups.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-3 text-xs leading-5 text-muted-foreground">
            No approved quotes match these filters.
          </p>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <section key={group.key} className="space-y-2">
                <div className="flex items-center justify-between gap-2 px-1">
                  <h3 className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {GROUP_LABELS[groupBy]} |{" "}
                    {groupBy === "meeting"
                      ? renderPolicy.maskConsultationTitle(group.label)
                      : renderPolicy.maskText(group.label)}
                  </h3>
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    {group.quotes.length}
                  </span>
                </div>

                <div className="space-y-2">
                  {group.quotes.map((quote) => {
                    const rendered = renderQuote(quote, renderPolicy);
                    const meetingTitle = renderPolicy.maskConsultationTitle(quote.meetingTitle);
                    const insightLabels = quote.links.map((link) =>
                      renderPolicy.maskText(link.insightLabel)
                    );
                    const metadata = [
                      rendered.attribution,
                      meetingTitle,
                      insightLabels[0],
                    ].filter((value): value is string => Boolean(value));

                    return (
                      <article
                        key={`${group.key}-${quote.id}`}
                        className={cn(
                          "rounded-md border border-border bg-background p-3 shadow-sm",
                          rendered.riskFlagged && "border-amber-300 bg-amber-50/40"
                        )}
                      >
                        <p className="line-clamp-4 text-sm leading-6 text-foreground">
                          &ldquo;{rendered.text}&rdquo;
                        </p>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {metadata.map((value) => (
                            <Badge key={value} variant="secondary" className="max-w-full truncate text-[11px]">
                              {value}
                            </Badge>
                          ))}
                          {rendered.masked && (
                            <Badge variant="outline" className="text-[11px]">
                              Masked
                            </Badge>
                          )}
                          {rendered.riskFlagged && (
                            <Badge variant="outline" className="border-amber-300 text-[11px] text-amber-700">
                              Risk
                            </Badge>
                          )}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="mt-3 h-8 w-full gap-2 text-xs"
                          onClick={() =>
                            onInsertMarkdown(
                              formatQuoteInsertionMarkdown(quote, rendered, {
                                meetingTitle,
                                insightLabels,
                              })
                            )
                          }
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Insert quote
                        </Button>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
