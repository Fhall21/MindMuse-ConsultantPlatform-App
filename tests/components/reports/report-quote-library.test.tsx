// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReportQuoteLibrary } from "@/components/reports/report-quote-library";
import type { ReportQuoteLibraryQuote } from "@/lib/report-quote-library";
import type { ReportRenderPolicy } from "@/lib/report-render-policy";

const approvedQuotes: ReportQuoteLibraryQuote[] = [
  {
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
  },
];

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
    expect(screen.getByText(/handoff gets messy/i)).toBeInTheDocument();
    expect(screen.getByText("Handoff ownership is unclear")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /insert quote/i }));

    expect(onInsertMarkdown).toHaveBeenCalledWith(
      expect.stringContaining(
        "> The handoff gets messy when three teams touch the same request."
      )
    );
    expect(onInsertMarkdown).toHaveBeenCalledWith(
      expect.stringContaining("Meeting: Operations workshop")
    );
  });

  it("masks provenance labels before display and insertion in anonymous mode", () => {
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

    expect(screen.getByText("Theme 1")).toBeInTheDocument();
    expect(screen.queryByText("Operations workshop")).not.toBeInTheDocument();
    expect(screen.queryByText("Handoff ownership is unclear")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /insert quote/i }));

    expect(onInsertMarkdown).toHaveBeenCalledWith(expect.stringContaining("Meeting: Meeting 1"));
    expect(onInsertMarkdown).toHaveBeenCalledWith(expect.stringContaining("Insight: Theme 1"));
    expect(onInsertMarkdown).not.toHaveBeenCalledWith(
      expect.stringContaining("Operations workshop")
    );
  });
});
