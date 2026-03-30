import { describe, expect, it } from "vitest";
import { buildExportSections } from "@/lib/report-export-content";
import type { ReportArtifactDetail } from "@/lib/actions/reports";

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
        { id: "c-1", title: "Interview with Alice", date: "2026-01-10", people: ["Alice Smith"] },
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
