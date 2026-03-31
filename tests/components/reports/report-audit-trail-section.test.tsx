// @vitest-environment jsdom

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuditTrailSection } from "@/components/reports/report-audit-trail-section";
import type { ReportArtifactDetail } from "@/types/report-artifact";

function makeReport(
  overrides: Partial<ReportArtifactDetail> = {}
): ReportArtifactDetail {
  return {
    id: "test-id-1234",
    artifactType: "report",
    title: "Test Report",
    content: "",
    roundId: "round-1",
    roundLabel: "Round 1",
    roundDescription: null,
    generatedAt: "2026-01-15T10:00:00Z",
    updatedAt: "2026-01-15T10:00:00Z",
    inputSnapshot: {},
    consultationTitles: [],
    consultations: [],
    acceptedThemeCount: 0,
    supportingThemeCount: 0,
    versionNumber: 1,
    totalVersions: 1,
    auditSummary: [],
    draftThemeGroups: [],
    ...overrides,
  };
}

describe("AuditTrailSection", () => {
  it("renders the two-tier compliance audit trail", () => {
    render(
      <AuditTrailSection
        report={makeReport({
          consultations: [
            {
              id: "c-1",
              title: "Leadership Team",
              date: "2026-01-12T10:00:00Z",
              people: ["Alice Smith"],
              meetingTypeLabel: "1-1 Interview",
              participantLabels: ["Strategy"],
            },
          ],
          auditSummary: [
            {
              action: "transcript.parsed",
              createdAt: "2026-01-11T10:00:00Z",
              entityType: null,
            },
            {
              action: "round.target_accepted",
              createdAt: "2026-01-12T11:00:00Z",
              entityType: null,
            },
            {
              action: "round.target_accepted",
              createdAt: "2026-01-12T12:00:00Z",
              entityType: null,
            },
            {
              action: "evidence_email.sent",
              createdAt: "2026-01-12T13:00:00Z",
              entityType: null,
            },
          ],
        })}
      />
    );

    expect(screen.getByText("Audit Trail")).toBeInTheDocument();
    expect(screen.getByText("Consultation sessions")).toBeInTheDocument();
    expect(screen.getByText("Process record")).toBeInTheDocument();
    expect(screen.getByText("1-1 with Strategy (1 person)")).toBeInTheDocument();
    expect(screen.getByText("2 themes validated")).toBeInTheDocument();
    expect(screen.getByText("Evidence email sent")).toBeInTheDocument();
    expect(screen.queryByText("Transcript parsed")).not.toBeInTheDocument();
    expect(screen.queryByText("Alice Smith")).not.toBeInTheDocument();
  });

  it("omits the section when there is no compliance audit content", () => {
    const { container } = render(
      <AuditTrailSection
        report={makeReport({
          auditSummary: [
            {
              action: "transcript.parsed",
              createdAt: "2026-01-11T10:00:00Z",
              entityType: null,
            },
          ],
        })}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});