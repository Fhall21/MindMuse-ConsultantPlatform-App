import { describe, it, expect } from "vitest";
import {
  PREDEFINED_SECTIONS,
  getPredefinedSection,
  getDefaultSections,
  sectionConfigToTemplateSection,
} from "@/lib/report-sections-registry";
import type { BuilderSectionConfig, CustomSectionDef } from "@/types/db";

describe("PREDEFINED_SECTIONS", () => {
  it("has 8 predefined sections", () => {
    expect(PREDEFINED_SECTIONS).toHaveLength(8);
  });

  it("each section has required fields", () => {
    for (const section of PREDEFINED_SECTIONS) {
      expect(section.id).toBeTruthy();
      expect(section.heading).toBeTruthy();
      expect(section.description).toBeTruthy();
      expect(section.defaultPurpose).toBeTruthy();
      expect(section.defaultProseGuidance).toBeTruthy();
      expect(["brief", "detailed"]).toContain(section.defaultDepth);
      expect(["core", "evidence", "analysis"]).toContain(section.category);
    }
  });

  it("has unique IDs", () => {
    const ids = PREDEFINED_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("getPredefinedSection", () => {
  it("returns section for valid ID", () => {
    const section = getPredefinedSection("executive-summary");
    expect(section).not.toBeNull();
    expect(section!.heading).toBe("Executive Summary");
  });

  it("returns null for unknown ID", () => {
    expect(getPredefinedSection("nonexistent")).toBeNull();
  });
});

describe("getDefaultSections", () => {
  it("returns 4 default sections", () => {
    const defaults = getDefaultSections();
    expect(defaults).toHaveLength(4);
  });

  it("includes executive-summary, key-themes, recommendations, evidence", () => {
    const ids = getDefaultSections().map((s) => s.sectionId);
    expect(ids).toEqual([
      "executive-summary",
      "key-themes",
      "recommendations",
      "evidence",
    ]);
  });

  it("has sequential positions starting at 0", () => {
    const positions = getDefaultSections().map((s) => s.position);
    expect(positions).toEqual([0, 1, 2, 3]);
  });

  it("each config has a note of null", () => {
    for (const config of getDefaultSections()) {
      expect(config.note).toBeNull();
      expect(config.purpose).toBeTruthy();
      expect(config.proseGuidance).toBeTruthy();
    }
  });
});

describe("sectionConfigToTemplateSection", () => {
  it("converts a predefined section config", () => {
    const config: BuilderSectionConfig = {
      sectionId: "executive-summary",
      depth: "brief",
      note: "Keep it short",
      position: 0,
    };
    const result = sectionConfigToTemplateSection(config, []);
    expect(result.heading).toBe("Executive Summary");
    expect(result.depth).toBe("brief");
    expect(result.section_note).toBe("Keep it short");
    expect(result.purpose).toBeTruthy();
    expect(result.prose_guidance).toBeTruthy();
    expect(result.example_excerpt).toBeNull();
  });

  it("prefers builder overrides for predefined sections", () => {
    const config: BuilderSectionConfig = {
      sectionId: "executive-summary",
      depth: "brief",
      note: "Keep it short",
      purpose: "Custom description",
      proseGuidance: "Custom elaboration",
      position: 0,
    };

    const result = sectionConfigToTemplateSection(config, []);

    expect(result.purpose).toBe("Custom description");
    expect(result.prose_guidance).toBe("Custom elaboration");
  });

  it("converts a custom section config", () => {
    const custom: CustomSectionDef = {
      id: "custom-abc",
      heading: "My Section",
      description: "Custom purpose",
      proseGuidance: "Custom elaboration",
    };
    const config: BuilderSectionConfig = {
      sectionId: "custom-abc",
      depth: "detailed",
      note: null,
      purpose: custom.description,
      proseGuidance: custom.proseGuidance,
      position: 0,
    };
    const result = sectionConfigToTemplateSection(config, [custom]);
    expect(result.heading).toBe("My Section");
    expect(result.purpose).toBe("Custom purpose");
    expect(result.prose_guidance).toBe("Custom elaboration");
    expect(result.depth).toBe("detailed");
    expect(result.section_note).toBeNull();
  });

  it("falls back to 'Untitled Section' for unknown custom section", () => {
    const config: BuilderSectionConfig = {
      sectionId: "custom-unknown",
      depth: "brief",
      note: null,
      position: 0,
    };
    const result = sectionConfigToTemplateSection(config, []);
    expect(result.heading).toBe("Untitled Section");
  });
});
