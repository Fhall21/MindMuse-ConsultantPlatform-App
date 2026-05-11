"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlignLeft, ChevronDown, Plus, Search, Type } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  formatKeyQuoteMarkdown,
  formatInlineQuoteMarkdown,
  groupReportQuotes,
  quoteRequiresAnonymousRiskConfirmation,
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
  const [accordionMode, setAccordionMode] = useState(true);
  const [openGroupKey, setOpenGroupKey] = useState<string | null>(null);
  const [popoverOpenId, setPopoverOpenId] = useState<string | null>(null);
  const [flashedId, setFlashedId] = useState<string | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up flash timer on unmount
  useEffect(() => {
    return () => {
      if (flashTimerRef.current !== null) clearTimeout(flashTimerRef.current);
    };
  }, []);

  function triggerFlash(id: string) {
    if (flashTimerRef.current !== null) clearTimeout(flashTimerRef.current);
    setFlashedId(id);
    flashTimerRef.current = setTimeout(() => setFlashedId(null), 1200);
  }

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

  // When search is active, expand all groups regardless of accordion mode.
  const isSearchActive = search.trim().length > 0;
  const useAccordion = accordionMode && !isSearchActive;

  function handleGroupToggle(key: string) {
    setOpenGroupKey((prev) => (prev === key ? null : key));
  }

  return (
    <aside
      className="flex h-[70vh] flex-col overflow-hidden rounded-lg border border-border bg-muted/20"
      aria-label="Approved quote library"
    >
      {/* Sticky controls */}
      <div className="shrink-0 space-y-3 border-b border-border/70 p-4">
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

        <div className="flex items-center gap-2">
          <Checkbox
            id="accordion-toggle"
            checked={accordionMode}
            onCheckedChange={(checked) => {
              setAccordionMode(checked === true);
              setOpenGroupKey(null);
            }}
          />
          <Label
            htmlFor="accordion-toggle"
            className="cursor-pointer select-none text-xs text-muted-foreground"
          >
            Collapse groups
          </Label>
        </div>
      </div>

      {/* Scrollable quote list */}
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
          <div className="space-y-1">
            {groups.map((group) => {
              const groupLabel =
                groupBy === "meeting"
                  ? renderPolicy.maskConsultationTitle(group.label)
                  : renderPolicy.maskText(group.label);

              const quoteCards = (
                <div className="space-y-2 pb-1 pt-1">
                  {group.quotes.map((quote) => {
                    const rendered = renderQuote(quote, renderPolicy);

                    // Attribution for insertion: Speaker + Workgroup, deduped
                    const maskedWorkgroup = quote.workGroupLabel
                      ? renderPolicy.maskText(quote.workGroupLabel)
                      : null;
                    const attrParts = [rendered.attribution];
                    if (maskedWorkgroup && maskedWorkgroup !== rendered.attribution) {
                      attrParts.push(maskedWorkgroup);
                    }
                    const insertionAttribution =
                      attrParts.filter(Boolean).join(", ") || null;

                    // Metadata badges for display on the card (not inserted into doc)
                    const meetingTitle = renderPolicy.maskConsultationTitle(quote.meetingTitle);
                    const insightLabels = quote.links.map((link) =>
                      renderPolicy.maskText(link.insightLabel)
                    );
                    const displayBadges = [
                      rendered.attribution,
                      meetingTitle,
                      insightLabels[0],
                    ].filter((value): value is string => Boolean(value));

                    const requiresRiskConfirmation = quoteRequiresAnonymousRiskConfirmation(
                      rendered,
                      renderPolicy.anonymousMode
                    );
                    const riskWarning =
                      quote.riskReason?.trim() ||
                      "This quote may still identify someone after anonymous-mode masking.";

                    const isFlashing = flashedId === quote.id;
                    const isPopoverOpen = popoverOpenId === quote.id;

                    function handleInsertClick(format: "key" | "inline") {
                      setPopoverOpenId(null);
                      const markdown =
                        format === "key"
                          ? formatKeyQuoteMarkdown(rendered.text, insertionAttribution)
                          : formatInlineQuoteMarkdown(rendered.text, insertionAttribution);
                      onInsertMarkdown(markdown);
                      triggerFlash(quote.id);
                    }

                    function handleTriggerClick() {
                      if (requiresRiskConfirmation) {
                        const confirmed = window.confirm(
                          `This quote is flagged as potentially identifying in anonymous mode.\n\n${riskWarning}\n\nInsert it anyway?`
                        );
                        if (!confirmed) return;
                      }
                      setPopoverOpenId((prev) => (prev === quote.id ? null : quote.id));
                    }

                    return (
                      <article
                        key={`${group.key}-${quote.id}`}
                        className={cn(
                          "rounded-md border border-border bg-background p-3 shadow-sm transition-shadow duration-500",
                          requiresRiskConfirmation && "border-amber-300 bg-amber-50/40",
                          isFlashing && "ring-2 ring-primary/40"
                        )}
                      >
                        <p className="line-clamp-4 text-sm leading-6 text-foreground">
                          &ldquo;{rendered.text}&rdquo;
                        </p>
                        {requiresRiskConfirmation && (
                          <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs leading-5 text-amber-900">
                            Anonymous risk: {riskWarning}
                          </p>
                        )}
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {displayBadges.map((value) => (
                            <Badge
                              key={value}
                              variant="secondary"
                              className="max-w-full truncate text-[11px]"
                            >
                              {value}
                            </Badge>
                          ))}
                          {rendered.masked && (
                            <Badge variant="outline" className="text-[11px]">
                              Masked
                            </Badge>
                          )}
                          {rendered.riskFlagged && (
                            <Badge
                              variant="outline"
                              className="border-amber-300 text-[11px] text-amber-700"
                            >
                              Risk
                            </Badge>
                          )}
                        </div>

                        {/* Insert picker */}
                        <Popover
                          open={isPopoverOpen}
                          onOpenChange={(open) => { if (!open) setPopoverOpenId(null); }}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="mt-3 h-8 w-full gap-2 text-xs"
                              onClick={handleTriggerClick}
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Insert quote
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            align="center"
                            side="top"
                            sideOffset={6}
                            className="w-52 p-1.5"
                          >
                            <div className="space-y-0.5">
                              <button
                                type="button"
                                onClick={() => handleInsertClick("key")}
                                className="flex w-full items-start gap-3 rounded-sm px-2.5 py-2 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                <AlignLeft className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                <div>
                                  <p className="text-xs font-medium text-foreground">Key quote</p>
                                  <p className="text-[11px] text-muted-foreground">Standalone block</p>
                                </div>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleInsertClick("inline")}
                                className="flex w-full items-start gap-3 rounded-sm px-2.5 py-2 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                <Type className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                <div>
                                  <p className="text-xs font-medium text-foreground">Inline</p>
                                  <p className="text-[11px] text-muted-foreground">Woven into prose</p>
                                </div>
                              </button>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </article>
                    );
                  })}
                </div>
              );

              if (useAccordion) {
                return (
                  <Collapsible
                    key={group.key}
                    open={openGroupKey === group.key}
                    onOpenChange={() => handleGroupToggle(group.key)}
                  >
                    <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 rounded-sm px-1 py-1.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {GROUP_LABELS[groupBy]} | {groupLabel}
                      </span>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className="text-[11px] tabular-nums text-muted-foreground">
                          {group.quotes.length}
                        </span>
                        <ChevronDown
                          className={cn(
                            "h-3.5 w-3.5 text-muted-foreground/60 transition-transform duration-200",
                            openGroupKey === group.key && "rotate-180"
                          )}
                        />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>{quoteCards}</CollapsibleContent>
                  </Collapsible>
                );
              }

              return (
                <section key={group.key} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 px-1 py-1.5">
                    <h3 className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {GROUP_LABELS[groupBy]} | {groupLabel}
                    </h3>
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {group.quotes.length}
                    </span>
                  </div>
                  {quoteCards}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
