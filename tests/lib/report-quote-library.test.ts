import { describe, expect, it } from "vitest";
import {
  formatInlineQuoteMarkdown,
  formatKeyQuoteMarkdown,
  formatQuoteInsertionMarkdown,
  groupReportQuotes,
  quoteMatchesReportFilters,
  quoteRequiresAnonymousRiskConfirmation,
  type ReportQuoteLibraryQuote,
} from "@/lib/report-quote-library";

function quote(
  overrides: Partial<ReportQuoteLibraryQuote> = {}
): ReportQuoteLibraryQuote {
  const now = new Date("2026-05-08T00:00:00.000Z");
  return {
    id: "quote-1",
    meetingId: "meeting-1",
    meetingTitle: "Operations workshop",
    spanStart: 10,
    spanEnd: 72,
    exactText: "The handoff gets messy when three teams touch the same request.",
    speakerLabel: "Riley",
    workGroupLabel: "Operations",
    personId: "person-1",
    status: "approved",
    source: "manual",
    anonymousMaskRule: "role_workgroup",
    riskFlag: false,
    justification: null,
    contextBefore: null,
    contextAfter: null,
    riskReason: null,
    rejectionReason: null,
    approvedAt: now,
    createdAt: now,
    updatedAt: now,
    links: [
      {
        insightId: "insight-1",
        insightLabel: "Handoff ownership is unclear",
        isPrimary: true,
        linkType: "durable",
      },
    ],
    ...overrides,
  };
}

describe("report quote library helpers", () => {
  it("filters approved report quotes by source and searchable metadata", () => {
    const candidate = quote({ source: "ai" });

    expect(
      quoteMatchesReportFilters(candidate, {
        source: "ai",
        search: "handoff ownership",
      })
    ).toBe(true);
    expect(
      quoteMatchesReportFilters(candidate, {
        source: "manual",
        search: "handoff",
      })
    ).toBe(false);
  });

  it("groups quotes by linked insight and keeps unlinked quotes visible", () => {
    const grouped = groupReportQuotes(
      [
        quote(),
        quote({ id: "quote-2", links: [], exactText: "No linked insight yet." }),
      ],
      { groupBy: "insight", source: "all", search: "" }
    );

    expect(grouped.map((group) => group.label)).toEqual([
      "Handoff ownership is unclear",
      "No linked insight",
    ]);
    expect(grouped[1].quotes).toHaveLength(1);
  });

  it("formats inserted markdown with rendered text and lightweight provenance", () => {
    const markdown = formatQuoteInsertionMarkdown(quote(), {
      text: "A member of operations described the handoff as messy.",
      attribution: "Operations",
      masked: true,
      riskFlagged: true,
    });

    expect(markdown).toContain("> A member of operations described the handoff as messy.");
    expect(markdown).toContain("Source: Operations");
    expect(markdown).toContain("Meeting: Operations workshop");
    expect(markdown).toContain("Insight: Handoff ownership is unclear");
    expect(markdown).toContain("Masked for anonymous mode");
    expect(markdown).toContain("Review before external sharing");
  });

  it("formats key quote markdown as a standalone pull quote", () => {
    expect(formatKeyQuoteMarkdown("A concise evidence quote.", "Riley, Operations")).toBe(
      "> \u201CA concise evidence quote.\u201D\n>\n> \u2014 Riley, Operations"
    );
  });

  it("formats inline quote markdown without blockquote syntax", () => {
    expect(formatInlineQuoteMarkdown("A concise evidence quote.", "Riley, Operations")).toBe(
      "\u201CA concise evidence quote.\u201D \u2014 Riley, Operations"
    );
  });

  it("requires risk confirmation only when anonymous mode and rendered risk are both present", () => {
    expect(quoteRequiresAnonymousRiskConfirmation({ riskFlagged: true }, true)).toBe(true);
    expect(quoteRequiresAnonymousRiskConfirmation({ riskFlagged: true }, false)).toBe(false);
    expect(quoteRequiresAnonymousRiskConfirmation({ riskFlagged: false }, true)).toBe(false);
  });

  it("uses caller-provided masked provenance labels when inserting markdown", () => {
    const markdown = formatQuoteInsertionMarkdown(
      quote(),
      {
        text: "Masked quote.",
        attribution: "Operations",
        masked: true,
        riskFlagged: false,
      },
      {
        meetingTitle: "Meeting 1",
        insightLabels: ["Theme 1"],
      }
    );

    expect(markdown).toContain("Meeting: Meeting 1");
    expect(markdown).toContain("Insight: Theme 1");
    expect(markdown).not.toContain("Operations workshop");
    expect(markdown).not.toContain("Handoff ownership is unclear");
  });
});
