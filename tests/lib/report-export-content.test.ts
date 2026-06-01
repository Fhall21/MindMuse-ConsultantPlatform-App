import { describe, expect, it } from "vitest";
import { buildExportSections } from "@/lib/report-export-content";
import { applyRenderPolicyToReport } from "@/lib/report-render-policy";
import type { ReportArtifactDetail } from "@/types/report-artifact";

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function makeReport(overrides: Partial<ReportArtifactDetail> = {}): ReportArtifactDetail {
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

function makeInputSnapshot(themes: Array<{ label: string; status: string; description?: string | null }>) {
  return {
    all_theme_groups: themes.map((t, i) => ({
      id: `group-${i}`,
      label: t.label,
      description: t.description ?? null,
      status: t.status,
      origin: "round",
      members: [],
    })),
  };
}

// ─── Content section splitting ────────────────────────────────────────────────

describe("buildExportSections — content splitting", () => {
  it("returns empty section list for empty content with no data", () => {
    const sections = buildExportSections(makeReport({ content: "" }), "standard");
    // No content blocks → no content sections. No themes/evidence/audit either.
    expect(sections).toHaveLength(0);
  });

  it("puts prose before first heading into a preamble section with heading null", () => {
    const report = makeReport({ content: "Intro paragraph.\n\nMore intro." });
    const sections = buildExportSections(report, "standard");
    expect(sections[0].heading).toBeNull();
    expect(sections[0].isPageBreak).toBe(false);
    expect(sections[0].blocks[0]).toMatchObject({ type: "prose", text: "Intro paragraph." });
  });

  it("splits content on heading1 boundaries into separate sections", () => {
    const report = makeReport({
      content: "# Section One\nContent one.\n\n# Section Two\nContent two.",
    });
    const sections = buildExportSections(report, "standard");
    const contentSections = sections.filter((s) => s.heading !== null && !s.data);
    expect(contentSections[0].heading).toBe("Section One");
    expect(contentSections[1].heading).toBe("Section Two");
  });

  it("sets isPageBreak true on heading1-split sections", () => {
    const report = makeReport({ content: "# First\nHello.\n\n# Second\nWorld." });
    const sections = buildExportSections(report, "standard");
    const named = sections.filter((s) => !s.data);
    for (const s of named) {
      expect(s.isPageBreak).toBe(true);
    }
  });

  it("does not drop preamble when heading1 exists after it", () => {
    const report = makeReport({ content: "Intro text.\n\n# Section A\nBody." });
    const sections = buildExportSections(report, "standard");
    const preamble = sections.find((s) => s.heading === null && !s.data);
    expect(preamble).toBeDefined();
    expect(preamble!.blocks[0]).toMatchObject({ type: "prose", text: "Intro text." });
  });

  it("preserves heading2 and heading3 as blocks within a section", () => {
    const report = makeReport({
      content: "# Top\n## Sub\nText.\n### Deep\nDeeper.",
    });
    const sections = buildExportSections(report, "standard");
    const topSection = sections.find((s) => s.heading === "Top");
    expect(topSection).toBeDefined();
    const types = topSection!.blocks.map((b) => b.type);
    expect(types).toContain("heading2");
    expect(types).toContain("heading3");
  });

  it("includes bullet and numbered list blocks", () => {
    const report = makeReport({
      content: "# List Section\n- item a\n- item b\n\n1. first\n2. second",
    });
    const sections = buildExportSections(report, "standard");
    const listSection = sections.find((s) => s.heading === "List Section");
    expect(listSection).toBeDefined();
    const types = listSection!.blocks.map((b) => b.type);
    expect(types).toContain("bullet");
    expect(types).toContain("numbered");
  });
});

// ─── Theme section ────────────────────────────────────────────────────────────

describe("buildExportSections — Key Themes section", () => {
  it("appends a Key Themes section when accepted themes exist", () => {
    const report = makeReport({
      inputSnapshot: makeInputSnapshot([
        { label: "Governance", status: "accepted" },
      ]),
    });
    const sections = buildExportSections(report, "standard");
    const themes = sections.find((s) => s.heading === "Key Themes");
    expect(themes).toBeDefined();
    expect(themes!.data?.kind).toBe("themes");
  });

  it("includes draft themes in standard template", () => {
    const report = makeReport({
      inputSnapshot: makeInputSnapshot([
        { label: "Accepted", status: "accepted" },
        { label: "Pending", status: "draft" },
      ]),
    });
    const sections = buildExportSections(report, "standard");
    const themes = sections.find((s) => s.heading === "Key Themes");
    expect(themes!.data?.kind).toBe("themes");
    if (themes!.data?.kind === "themes") {
      const labels = themes!.data.themes.map((t) => t.label);
      expect(labels).toContain("Accepted");
      expect(labels).toContain("Pending");
    }
  });

  it("excludes draft themes in executive template", () => {
    const report = makeReport({
      inputSnapshot: makeInputSnapshot([
        { label: "Accepted", status: "accepted" },
        { label: "Pending", status: "draft" },
      ]),
    });
    const sections = buildExportSections(report, "executive");
    const themes = sections.find((s) => s.heading === "Key Themes");
    if (themes?.data?.kind === "themes") {
      const labels = themes.data.themes.map((t) => t.label);
      expect(labels).toContain("Accepted");
      expect(labels).not.toContain("Pending");
    }
  });

  it("caps accepted themes at 3 for executive template", () => {
    const report = makeReport({
      inputSnapshot: makeInputSnapshot([
        { label: "T1", status: "accepted" },
        { label: "T2", status: "accepted" },
        { label: "T3", status: "accepted" },
        { label: "T4", status: "accepted" },
      ]),
    });
    const sections = buildExportSections(report, "executive");
    const themes = sections.find((s) => s.heading === "Key Themes");
    expect(themes?.data?.kind).toBe("themes");
    if (themes?.data?.kind === "themes") {
      expect(themes.data.themes).toHaveLength(3);
    }
  });

  it("omits Key Themes section when no accepted or draft themes exist", () => {
    const report = makeReport({
      inputSnapshot: makeInputSnapshot([
        { label: "Rejected", status: "management_rejected" },
      ]),
    });
    const sections = buildExportSections(report, "standard");
    expect(sections.find((s) => s.heading === "Key Themes")).toBeUndefined();
  });

  it("includes Rejected Themes section in standard template when rejected themes exist", () => {
    const report = makeReport({
      inputSnapshot: makeInputSnapshot([
        { label: "Not needed", status: "management_rejected" },
      ]),
    });
    const sections = buildExportSections(report, "standard");
    expect(sections.find((s) => s.heading === "Rejected Themes")).toBeDefined();
  });

  it("omits Rejected Themes section in executive template", () => {
    const report = makeReport({
      inputSnapshot: makeInputSnapshot([
        { label: "Not needed", status: "management_rejected" },
      ]),
    });
    const sections = buildExportSections(report, "executive");
    expect(sections.find((s) => s.heading === "Rejected Themes")).toBeUndefined();
  });
});

// ─── Evidence section ─────────────────────────────────────────────────────────

describe("buildExportSections — Source Evidence section", () => {
  it("appends Source Evidence when consultationTitles present", () => {
    const report = makeReport({
      consultationTitles: ["Interview with Alice", "Focus Group B"],
    });
    const sections = buildExportSections(report, "standard");
    const evidence = sections.find((s) => s.heading === "Source Evidence");
    expect(evidence).toBeDefined();
    expect(evidence!.data?.kind).toBe("evidence");
  });

  it("prefers full consultation objects over titles when available", () => {
    const report = makeReport({
      consultationTitles: ["Fallback title"],
      consultations: [
        {
          id: "c-1",
          title: "Interview with Alice",
          date: "2026-01-10",
          people: ["Alice Smith"],
          meetingTypeLabel: "1-1 Interview",
          participantLabels: ["Sales"],
        },
      ],
    });
    const sections = buildExportSections(report, "standard");
    const evidence = sections.find((s) => s.heading === "Source Evidence");
    if (evidence?.data?.kind === "evidence") {
      expect(evidence.data.consultations[0].people).toContain("Alice Smith");
    }
  });

  it("omits Source Evidence when no consultations or titles", () => {
    const sections = buildExportSections(makeReport(), "standard");
    expect(sections.find((s) => s.heading === "Source Evidence")).toBeUndefined();
  });

  it("reuses anonymised report output for content and evidence sections", () => {
    const renderedReport = applyRenderPolicyToReport(
      makeReport({
        content: "# Summary\nAlice Smith raised this in Interview with Alice.",
        consultations: [
          {
            id: "c-1",
            title: "Interview with Alice",
            date: "2026-01-10",
            people: ["Alice Smith", "Jordan Patel"],
            meetingTypeLabel: "1-1 Interview",
            participantLabels: ["Strategy"],
          },
        ],
      }),
      true
    );

    const sections = buildExportSections(renderedReport, "standard");
    const summary = sections.find((section) => section.heading === "Summary");
    const evidence = sections.find((section) => section.heading === "Source Evidence");

    expect(summary?.blocks[0]).toMatchObject({
      type: "prose",
      text: "Participant 1 raised this in 1-1 with Strategy.",
    });

    expect(evidence?.data?.kind).toBe("evidence");
    if (evidence?.data?.kind === "evidence") {
      expect(evidence.data.consultations[0]).toMatchObject({
        title: "1-1 with Strategy",
        people: ["Participant 1", "Participant 2"],
      });
    }
  });
});

describe("buildExportSections — Audit Trail section", () => {
  it("builds the two-tier compliance audit trail for standard exports", () => {
    const report = makeReport({
      consultations: [
        {
          id: "c-1",
          title: "Leadership Team",
          date: "2026-01-12T10:00:00Z",
          people: ["Alice", "Eve"],
          meetingTypeLabel: "1-1 Interview",
          participantLabels: ["Strategy"],
        },
        {
          id: "c-2",
          title: "Working Group B",
          date: "2026-01-10T10:00:00Z",
          people: ["Bob", "Cara"],
          meetingTypeLabel: "Focus Group",
          participantLabels: ["Operations", "Operations"],
        },
      ],
      auditSummary: [
        { action: "transcript.parsed", createdAt: "2026-01-09T10:00:00Z", entityType: null },
        { action: "round.target_accepted", createdAt: "2026-01-11T10:00:00Z", entityType: null },
        { action: "round.target_accepted", createdAt: "2026-01-12T11:00:00Z", entityType: null },
        { action: "report.manually_edited", createdAt: "2026-01-12T12:00:00Z", entityType: null },
      ],
    });

    const sections = buildExportSections(report, "standard");
    const audit = sections.find((section) => section.heading === "Process Record");

    expect(audit?.data?.kind).toBe("audit");
    if (audit?.data?.kind === "audit") {
      expect(audit.data.sessions).toEqual([]);
      expect(audit.data.milestones.map((milestone) => milestone.label)).toEqual([
        "Report revised",
        "2 themes validated",
      ]);
    }
  });

  it("omits the audit trail from executive exports", () => {
    const report = makeReport({
      consultations: [
        {
          id: "c-1",
          title: "Leadership Team",
          date: "2026-01-12T10:00:00Z",
          people: [],
          meetingTypeLabel: null,
          participantLabels: [],
        },
      ],
      auditSummary: [
        { action: "evidence_email.sent", createdAt: "2026-01-12T12:00:00Z", entityType: null },
      ],
    });

    const sections = buildExportSections(report, "executive");
    expect(sections.find((section) => section.heading === "Audit Trail")).toBeUndefined();
  });
});

describe("buildExportSections — frame snapshots", () => {
  it("adds structured frame snapshot export data when saved frames exist", () => {
    const sections = buildExportSections(
      makeReport({
        inputSnapshot: {
          graphNetwork: {
            snapshotAt: "2026-05-06T00:00:00.000Z",
            nodes: [
              { nodeType: "group", nodeId: "group-1", label: "Operational risk" },
              { nodeType: "insight", nodeId: "insight-1", label: "Late handoffs" },
            ],
            edges: [
              {
                connectionId: "edge-1",
                fromNodeType: "insight",
                fromNodeId: "insight-1",
                toNodeType: "group",
                toNodeId: "group-1",
                connectionType: "supports",
                notes: "Evidence repeated across meetings.",
                origin: "manual",
              },
            ],
            layoutState: [],
            frames: [
              {
                frameId: "frame-1",
                name: "Risk story",
                nodeIds: ["group-1", "insight-1"],
                position: 0,
                viewport: { x: 0, y: 0, zoom: 1 },
              },
            ],
          },
        },
      }),
      "standard"
    );

    const frameSection = sections.find((section) => section.heading === "Curated Frame Snapshots");

    expect(frameSection?.data).toEqual({
      kind: "frameSnapshots",
      frames: [
        {
          id: "frame-1",
          name: "Risk story",
          nodeCount: 2,
          connectionCount: 1,
          connections: [
            {
              fromLabel: "Late handoffs",
              toLabel: "Operational risk",
              connectionType: "Supports",
              notes: "Evidence repeated across meetings.",
            },
          ],
          imageDataUrl: null,
        },
      ],
    });
  });

  it("keeps older no-frame artifacts off the frame export path", () => {
    const sections = buildExportSections(
      makeReport({
        inputSnapshot: {
          graphNetwork: {
            snapshotAt: "2026-05-06T00:00:00.000Z",
            nodes: [{ nodeType: "group", nodeId: "group-1", label: "Operational risk" }],
            edges: [],
            layoutState: [],
          },
        },
      }),
      "standard"
    );

    expect(sections.some((section) => section.heading === "Curated Frame Snapshots")).toBe(false);
  });
});

// ─── Section ordering ─────────────────────────────────────────────────────────

describe("buildExportSections — section ordering", () => {
  it("places structured data sections after content sections", () => {
    const report = makeReport({
      content: "# Main\nContent here.",
      consultationTitles: ["Meeting 1"],
      inputSnapshot: makeInputSnapshot([{ label: "Theme A", status: "accepted" }]),
    });
    const sections = buildExportSections(report, "standard");
    const headings = sections.map((s) => s.heading);
    const mainIdx = headings.indexOf("Main");
    const themesIdx = headings.indexOf("Key Themes");
    const evidenceIdx = headings.indexOf("Source Evidence");
    expect(mainIdx).toBeLessThan(themesIdx);
    expect(themesIdx).toBeLessThan(evidenceIdx);
  });
});
