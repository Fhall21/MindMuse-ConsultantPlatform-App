import { describe, expect, it } from "vitest";
import { applyRenderPolicyToReport } from "@/lib/report-render-policy";
import type { ReportArtifactDetail } from "@/types/report-artifact";

function makeReport(overrides: Partial<ReportArtifactDetail> = {}): ReportArtifactDetail {
  return {
    id: "report-1",
    artifactType: "report",
    title: "Update on Alice Smith follow-up",
    content:
      "# Executive Summary\nAlice Smith raised the issue in Interview with Alice.\n\n## Actions\n- Follow up with Alice on rota stability.",
    roundId: "round-1",
    roundLabel: "Round 1",
    roundDescription: "Interview with Alice informed this report.",
    generatedAt: "2026-01-15T10:00:00Z",
    updatedAt: "2026-01-15T10:00:00Z",
    consultationTitles: ["Interview with Alice"],
    consultations: [
      {
        id: "consultation-1",
        title: "Interview with Alice",
        date: "2026-01-10",
        people: ["Alice Smith", "Jordan Patel"],
        meetingTypeLabel: "1-1 Interview",
        participantLabels: ["Strategy"],
      },
    ],
    inputSnapshot: {
      all_theme_groups: [
        {
          id: "group-1",
          label: "Alice Smith escalation",
          description: "Interview with Alice highlighted repeated rota gaps.",
          status: "accepted",
          origin: "ai_refined",
          members: [
            {
              insightId: "insight-1",
              label: "Alice Smith described repeated rota gaps",
              description: "Interview with Alice highlighted operational strain.",
              sourceConsultationTitle: "Interview with Alice",
              isUserAdded: false,
              position: 0,
            },
          ],
        },
      ],
      graphNetwork: {
        snapshotAt: "2026-01-15T10:00:00Z",
        nodes: [
          {
            nodeType: "insight",
            nodeId: "insight-1",
            label: "Alice Smith described repeated rota gaps",
            meta: {
              description: "Interview with Alice highlighted operational strain.",
              consultationTitle: "Interview with Alice",
              groupLabel: "Alice Smith escalation",
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
            notes: "Alice Smith linked this to a repeat issue.",
            origin: "ai_suggested",
          },
        ],
        layoutState: [],
      },
    },
    acceptedThemeCount: 1,
    supportingThemeCount: 1,
    versionNumber: 1,
    totalVersions: 1,
    auditSummary: [],
    draftThemeGroups: [
      {
        id: "draft-1",
        label: "Draft for Alice Smith",
        description: "Interview with Alice still needs review.",
      },
    ],
    ...overrides,
  };
}

describe("applyRenderPolicyToReport", () => {
  it("masks outward-facing report data without mutating source records", () => {
    const report = makeReport();

    const rendered = applyRenderPolicyToReport(report, true);

    expect(rendered).not.toBe(report);
    expect(report.title).toBe("Update on Alice Smith follow-up");
    expect(report.content).toContain("Alice Smith");
    expect(report.consultations[0].title).toBe("Interview with Alice");
    expect(report.consultations[0].people).toEqual(["Alice Smith", "Jordan Patel"]);

    expect(rendered.title).toBe("Update on Participant 1 follow-up");
    expect(rendered.roundDescription).toBe("1-1 with Strategy informed this report.");
    expect(rendered.content).toContain("Participant 1 raised the issue in 1-1 with Strategy.");
    expect(rendered.content).not.toContain("Alice Smith");
    expect(rendered.consultationTitles).toEqual(["1-1 with Strategy"]);
    expect(rendered.consultations[0].title).toBe("1-1 with Strategy");
    expect(rendered.consultations[0].people).toEqual(["Participant 1", "Participant 2"]);
    expect(rendered.inputSnapshot.all_theme_groups?.[0].members[0].sourceConsultationTitle).toBe(
      "1-1 with Strategy"
    );
    expect(rendered.inputSnapshot.graphNetwork?.nodes[0].meta?.consultationTitle).toBe(
      "1-1 with Strategy"
    );
    expect(rendered.inputSnapshot.graphNetwork?.edges[0].notes).toContain("Participant 1");
    expect(rendered.draftThemeGroups[0].label).toContain("Participant 1");
  });

  it("falls back to generic meeting labels when only consultation titles exist", () => {
    const report = makeReport({
      consultationTitles: ["Session with Alice", "Workshop with Bob"],
      consultations: [],
      content: "Session with Alice and Workshop with Bob shaped the report.",
    });

    const rendered = applyRenderPolicyToReport(report, true);

    expect(rendered.consultationTitles).toEqual(["Meeting 1", "Meeting 2"]);
    expect(rendered.content).toContain("Meeting 1 and Meeting 2 shaped the report.");
  });
});