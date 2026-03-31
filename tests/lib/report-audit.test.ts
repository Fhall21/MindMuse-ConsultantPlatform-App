import { describe, expect, it } from "vitest";
import {
  buildComplianceAuditTrail,
  hasComplianceAuditTrailContent,
} from "@/lib/report-audit";
import type { AuditSummaryEvent } from "@/types/report-artifact";

// Helper: build a minimal AuditSummaryEvent
function evt(
  action: string,
  createdAtOffset: number = 0,
  baseMs: number = 1_700_000_000_000
): AuditSummaryEvent {
  return {
    action,
    createdAt: new Date(baseMs + createdAtOffset).toISOString(),
    entityType: null,
  };
}

function consultation(
  title: string,
  date: string,
  people: string[] = []
) {
  return {
    id: `${title}-${date}`,
    title,
    date,
    people,
  };
}

describe("lib/report-audit - buildComplianceAuditTrail", () => {
  it("sorts consultation sessions newest-first and excludes people", () => {
    const trail = buildComplianceAuditTrail({
      consultations: [
        consultation("Working Group B", "2026-01-10T10:00:00.000Z", ["Alice"]),
        consultation("Leadership Team", "2026-01-12T10:00:00.000Z", ["Bob"]),
      ],
      auditSummary: [],
    });

    expect(trail.sessions).toEqual([
      { title: "Leadership Team", date: "2026-01-12T10:00:00.000Z" },
      { title: "Working Group B", date: "2026-01-10T10:00:00.000Z" },
    ]);
  });

  it("filters process milestones down to the four compliance actions", () => {
    const trail = buildComplianceAuditTrail({
      consultations: [],
      auditSummary: [
        evt("transcript.parsed", 0),
        evt("evidence_email.sent", 1_000),
        evt("report.manually_edited", 2_000),
      ],
    });

    expect(trail.milestones.map((milestone) => milestone.label)).toEqual([
      "Report revised",
      "Evidence email sent",
    ]);
  });

  it("aggregates theme validation into one milestone with the latest timestamp", () => {
    const trail = buildComplianceAuditTrail({
      consultations: [],
      auditSummary: [
        evt("round.target_accepted", 0),
        evt("round.target_accepted", 10_000),
        evt("round.target_accepted", 20_000),
      ],
    });

    expect(trail.milestones).toHaveLength(1);
    expect(trail.milestones[0]).toMatchObject({
      action: "round.target_accepted",
      label: "3 themes validated",
      count: 3,
      createdAt: evt("round.target_accepted", 20_000).createdAt,
    });
  });

  it("keeps process milestones newest-first", () => {
    const trail = buildComplianceAuditTrail({
      consultations: [],
      auditSummary: [
        evt("evidence_email.sent", 0),
        evt("round.output_generated", 10_000),
        evt("report.manually_edited", 20_000),
      ],
    });

    expect(trail.milestones.map((milestone) => milestone.label)).toEqual([
      "Report revised",
      "Report generated",
      "Evidence email sent",
    ]);
  });

  it("reports when the compliance trail has content", () => {
    const emptyTrail = buildComplianceAuditTrail({
      consultations: [],
      auditSummary: [evt("transcript.parsed", 0)],
    });
    const populatedTrail = buildComplianceAuditTrail({
      consultations: [consultation("Leadership Team", "2026-01-12T10:00:00.000Z")],
      auditSummary: [],
    });

    expect(hasComplianceAuditTrailContent(emptyTrail)).toBe(false);
    expect(hasComplianceAuditTrailContent(populatedTrail)).toBe(true);
  });
});
