import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import {
  ReportPrintLayout,
  buildSectionElements,
} from "@/components/reports/report-print-layout";
import type { ReportArtifactDetail } from "@/types/report-artifact";

function makeReport(
  overrides: Partial<ReportArtifactDetail> = {}
): ReportArtifactDetail {
  return {
    id: "test-id-1234",
    artifactType: "report",
    title: "Test Report",
    content: "Executive summary content.",
    roundId: "round-1",
    roundLabel: "Round 1",
    roundDescription: null,
    generatedAt: "2026-01-15T10:00:00Z",
    updatedAt: "2026-01-15T10:00:00Z",
    inputSnapshot: {
      graphNetwork: {
        snapshotAt: "2026-01-15T10:00:00Z",
        nodes: [
          {
            nodeType: "insight",
            nodeId: "insight-1",
            label: "Repeated schedule disruption across multiple consultations",
            meta: {
              description: "Supporting theme from operational interviews",
              consultationTitle: "Weekly team consultation",
              groupLabel: "Operational pressure",
            },
          },
          {
            nodeType: "group",
            nodeId: "group-1",
            label: "Operational pressure",
            meta: {
              description: "Accepted grouped theme",
              memberCount: 3,
            },
          },
        ],
        edges: [
          {
            connectionId: "edge-1",
            fromNodeType: "insight",
            fromNodeId: "insight-1",
            toNodeType: "group",
            toNodeId: "group-1",
            connectionType: "supports",
            notes: "Evidence repeated across interviews and manager follow-up.",
            origin: "ai_suggested",
          },
        ],
        layoutState: [],
      },
      all_theme_groups: [
        {
          id: "group-1",
          label: "Operational pressure",
          description: "Accepted theme with linked support.",
          status: "accepted",
          origin: "ai_refined",
          members: [
            {
              insightId: "insight-1",
              label: "Repeated schedule disruption across multiple consultations",
              description: "Supporting theme from operational interviews",
              sourceConsultationTitle: "Weekly team consultation",
              isUserAdded: false,
              position: 0,
            },
          ],
        },
      ],
    },
    consultationTitles: [],
    consultations: [
      {
        id: "c-1",
        title:
          "Weekly team consultation covering repeated rota failures and safeguarding escalation follow-ups",
        date: "2026-01-12T10:00:00Z",
        people: ["Alice Smith", "Jordan Patel", "Morgan Chen"],
      },
    ],
    acceptedThemeCount: 1,
    supportingThemeCount: 1,
    versionNumber: 1,
    totalVersions: 1,
    auditSummary: [
      {
        action: "round.target_accepted",
        createdAt: "2026-01-12T11:00:00Z",
        entityType: null,
      },
      {
        action: "evidence_email.sent",
        createdAt: "2026-01-12T13:00:00Z",
        entityType: null,
      },
    ],
    draftThemeGroups: [],
    ...overrides,
  };
}

function collectText(node: React.ReactNode): string[] {
  if (typeof node === "string" || typeof node === "number") {
    return [String(node)];
  }

  if (!node) {
    return [];
  }

  if (Array.isArray(node)) {
    return node.flatMap((child) => collectText(child));
  }

  if (React.isValidElement(node)) {
    const element = node as React.ReactElement<{ children?: React.ReactNode }>;

    if (typeof element.type === "function") {
      const component = element.type as (props: typeof element.props) => React.ReactNode;
      return collectText(component(element.props));
    }

    return collectText(element.props.children);
  }

  return [];
}

function normalizeText(node: React.ReactNode): string {
  return collectText(node)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

describe("ReportPrintLayout", () => {
  it("builds stacked evidence, grouped network cards, and audit trail sections", () => {
    const sections = buildSectionElements(makeReport(), "standard");

    const evidence = sections.find((section) => section.id === "evidence");
    const network = sections.find((section) => section.id === "network");
    const auditTrail = sections.find((section) => section.id === "auditTrail");

    expect(evidence).toBeDefined();
    expect(network).toBeDefined();
    expect(auditTrail).toBeDefined();

    const evidenceText = normalizeText(evidence!.element);
    expect(evidenceText).toContain("Source Evidence");
    expect(evidenceText).toMatch(/Date\s*:\s*Jan 12, 2026/);
    expect(evidenceText).toMatch(/People\s*:\s*Alice Smith, Jordan Patel, Morgan Chen/);
    expect(evidenceText).toContain("Weekly team consultation covering repeated rota failures");

    const networkText = normalizeText(network!.element);
    expect(networkText).toContain("Evidence Network");
    expect(networkText).toContain("Supports");
    expect(networkText).toContain("From");
    expect(networkText).toContain("To");
    expect(networkText).toContain("AI accepted");
    expect(networkText).toContain("Evidence repeated across interviews and manager follow-up.");

    const auditText = normalizeText(auditTrail!.element);
    expect(auditText).toContain("Audit Trail");
    expect(auditText).toContain("Consultation sessions");
    expect(auditText).toContain("Process record");
    expect(auditText).toContain("Weekly team consultation covering repeated rota failures");
    expect(auditText).toContain("Evidence email sent");
  });

  it("renders a standard PDF without throwing for long evidence and network content", async () => {
    const buffer = await renderToBuffer(
      <ReportPrintLayout report={makeReport()} template="standard" />
    );

    expect(buffer.byteLength).toBeGreaterThan(1000);
  });
});