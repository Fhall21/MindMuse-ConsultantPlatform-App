// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReportQuoteLibrary } from "@/components/reports/report-quote-library";
import type { ReportQuoteLibraryQuote } from "@/lib/report-quote-library";
import type { ReportRenderPolicy } from "@/lib/report-render-policy";

const approvedQuotes: ReportQuoteLibraryQuote[] = [];

function quote(overrides: Partial<ReportQuoteLibraryQuote> = {}): ReportQuoteLibraryQuote {
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
    anonymousMaskRule: "none",
    riskFlag: false,
    riskReason: null,
    rejectionReason: null,
    approvedAt: new Date("2026-05-08T00:00:00.000Z"),
    createdAt: new Date("2026-05-08T00:00:00.000Z"),
    updatedAt: new Date("2026-05-08T00:00:00.000Z"),
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

vi.mock("@/hooks/use-quotes", () => ({
  useApprovedQuotesForMeetings: () => ({
    quotes: approvedQuotes,
    isLoading: false,
    isError: false,
    error: null,
  }),
}));

const renderPolicy: ReportRenderPolicy = {
  anonymousMode: false,
  maskText: (value) => value,
  maskPeople: (people) => people,
  maskConsultationTitle: (title) => title,
};

describe("ReportQuoteLibrary", () => {
  beforeEach(() => {
    approvedQuotes.splice(0, approvedQuotes.length, quote());
    vi.restoreAllMocks();
  });

  it("shows approved quotes and inserts rendered markdown on click", () => {
    const onInsertMarkdown = vi.fn();

    render(
      <ReportQuoteLibrary
        consultations={[
          {
            id: "meeting-1",
            title: "Operations workshop",
            date: "2026-05-08",
            people: ["Riley"],
            participantLabels: ["Riley"],
            meetingTypeLabel: "Workshop",
          },
        ]}
        renderPolicy={renderPolicy}
        onInsertMarkdown={onInsertMarkdown}
      />
    );

    expect(screen.getByText("Quote library")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /handoff ownership is unclear/i }));
    expect(screen.getByText(/handoff gets messy/i)).toBeInTheDocument();
    expect(screen.getByText("Handoff ownership is unclear")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /insert quote/i }));
    fireEvent.click(screen.getByRole("button", { name: /key quote/i }));

    expect(onInsertMarkdown).toHaveBeenCalledWith(
      expect.stringContaining(
        "> \u201CThe handoff gets messy when three teams touch the same request.\u201D"
      )
    );
    expect(onInsertMarkdown).toHaveBeenCalledWith(
      expect.stringContaining("> \u2014 Riley, Operations")
    );
  });

  it("masks provenance labels before display and insertion in anonymous mode", () => {
    approvedQuotes.splice(
      0,
      approvedQuotes.length,
      quote({ anonymousMaskRule: "role_workgroup" })
    );
    const onInsertMarkdown = vi.fn();

    render(
      <ReportQuoteLibrary
        consultations={[
          {
            id: "meeting-1",
            title: "Operations workshop",
            date: "2026-05-08",
            people: ["Riley"],
            participantLabels: ["Riley"],
            meetingTypeLabel: "Workshop",
          },
        ]}
        renderPolicy={{
          anonymousMode: true,
          maskText: (value) =>
            value
              .replace("Operations workshop", "Meeting 1")
              .replace("Handoff ownership is unclear", "Theme 1"),
          maskPeople: (people) => people.map(() => "Participant 1"),
          maskConsultationTitle: () => "Meeting 1",
        }}
        onInsertMarkdown={onInsertMarkdown}
      />
    );

    expect(screen.getByText(/Theme 1/)).toBeInTheDocument();
    expect(screen.queryByText("Operations workshop")).not.toBeInTheDocument();
    expect(screen.queryByText("Handoff ownership is unclear")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /theme 1/i }));
    fireEvent.click(screen.getByRole("button", { name: /insert quote/i }));
    fireEvent.click(screen.getByRole("button", { name: /key quote/i }));

    expect(onInsertMarkdown).toHaveBeenCalledWith(expect.stringContaining("> \u2014 Operations"));
    expect(onInsertMarkdown).not.toHaveBeenCalledWith(expect.stringContaining("Riley"));
    expect(onInsertMarkdown).not.toHaveBeenCalledWith(
      expect.stringContaining("Operations workshop")
    );
  });

  it("requires confirmation before inserting anonymous-mode risk quotes", () => {
    approvedQuotes.splice(
      0,
      approvedQuotes.length,
      quote({
        anonymousMaskRule: "role_workgroup",
        riskFlag: true,
        riskReason: "Names a one-off incident in a small team.",
      })
    );
    const onInsertMarkdown = vi.fn();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(
      <ReportQuoteLibrary
        consultations={[
          {
            id: "meeting-1",
            title: "Operations workshop",
            date: "2026-05-08",
            people: ["Riley"],
            participantLabels: ["Riley"],
            meetingTypeLabel: "Workshop",
          },
        ]}
        renderPolicy={{
          anonymousMode: true,
          maskText: (value) => value,
          maskPeople: (people) => people,
          maskConsultationTitle: (title) => title,
        }}
        onInsertMarkdown={onInsertMarkdown}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /handoff ownership is unclear/i }));
    expect(screen.getByText(/anonymous risk/i)).toHaveTextContent(
      "Names a one-off incident in a small team."
    );

    fireEvent.click(screen.getByRole("button", { name: /insert quote/i }));

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining("potentially identifying"));
    expect(onInsertMarkdown).not.toHaveBeenCalled();

    confirmSpy.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: /insert quote/i }));
    fireEvent.click(screen.getByRole("button", { name: /key quote/i }));

    expect(onInsertMarkdown).toHaveBeenCalledWith(
      expect.stringContaining("> \u201CThe handoff gets messy when three teams touch the same request.\u201D")
    );
  });
});
