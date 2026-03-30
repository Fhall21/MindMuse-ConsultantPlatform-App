import { describe, expect, it } from "vitest";
import { serializeToMarkdown } from "@/lib/report-export-markdown";
import type { ExportSection } from "@/lib/report-export-content";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeOpts(overrides: {
  title?: string | null;
  roundLabel?: string;
  artifactType?: string;
  sections?: ExportSection[];
}) {
  return {
    id: "abc12345-0000-0000-0000-000000000000",
    title: "title" in overrides ? (overrides.title ?? null) : "Test Report",
    roundLabel: overrides.roundLabel ?? "Round 1",
    generatedAt: "2026-01-15T10:00:00Z",
    artifactType: overrides.artifactType ?? "report",
    sections: overrides.sections ?? [],
  };
}

function section(
  heading: string | null,
  blocks: ExportSection["blocks"] = [],
  opts: Partial<Pick<ExportSection, "isPageBreak" | "data">> = {}
): ExportSection {
  return {
    heading,
    blocks,
    isPageBreak: opts.isPageBreak ?? false,
    data: opts.data,
  };
}

// ─── YAML frontmatter ─────────────────────────────────────────────────────────

describe("serializeToMarkdown — YAML frontmatter", () => {
  it("starts with --- and ends the frontmatter with ---", () => {
    const md = serializeToMarkdown(makeOpts({}));
    expect(md).toMatch(/^---\n/);
    // Closing delimiter may be followed by \n\n (when sections follow) or be at end of string
    expect(md).toMatch(/\n---(\n|$)/);
  });

  it("includes title in frontmatter", () => {
    const md = serializeToMarkdown(makeOpts({ title: "My Report" }));
    expect(md).toContain('title: "My Report"');
  });

  it("uses 'Untitled Report' when title is null", () => {
    const md = serializeToMarkdown(makeOpts({ title: null }));
    expect(md).toContain('title: "Untitled Report"');
  });

  it("escapes double-quotes in title", () => {
    const md = serializeToMarkdown(makeOpts({ title: 'Report "Alpha"' }));
    expect(md).toContain('title: "Report \\"Alpha\\""');
  });

  it("includes round label in frontmatter", () => {
    const md = serializeToMarkdown(makeOpts({ roundLabel: "Q1 2026" }));
    expect(md).toContain('round: "Q1 2026"');
  });

  it("maps artifactType to human label in frontmatter", () => {
    const md = serializeToMarkdown(makeOpts({ artifactType: "report" }));
    expect(md).toContain('type: "Board-Pack Report"');
  });

  it("sets confidential: true", () => {
    const md = serializeToMarkdown(makeOpts({}));
    expect(md).toContain("confidential: true");
  });

  it("includes the report id", () => {
    const md = serializeToMarkdown(makeOpts({}));
    expect(md).toContain('id: "abc12345-0000-0000-0000-000000000000"');
  });
});

// ─── Block serialisation ──────────────────────────────────────────────────────

describe("serializeToMarkdown — block types", () => {
  it("serialises heading1 blocks as # prefix", () => {
    const md = serializeToMarkdown(
      makeOpts({ sections: [section(null, [{ type: "heading1", text: "Title" }])] })
    );
    expect(md).toContain("# Title");
  });

  it("serialises heading2 blocks as ## prefix", () => {
    const md = serializeToMarkdown(
      makeOpts({ sections: [section(null, [{ type: "heading2", text: "Sub" }])] })
    );
    expect(md).toContain("## Sub");
  });

  it("serialises heading3 blocks as ### prefix", () => {
    const md = serializeToMarkdown(
      makeOpts({ sections: [section(null, [{ type: "heading3", text: "Deep" }])] })
    );
    expect(md).toContain("### Deep");
  });

  it("serialises prose blocks as plain text", () => {
    const md = serializeToMarkdown(
      makeOpts({ sections: [section(null, [{ type: "prose", text: "Some prose." }])] })
    );
    expect(md).toContain("Some prose.");
  });

  it("passes bold markers (**text**) through unchanged in prose", () => {
    const md = serializeToMarkdown(
      makeOpts({
        sections: [section(null, [{ type: "prose", text: "**Important** point." }])],
      })
    );
    expect(md).toContain("**Important** point.");
  });

  it("passes italic markers (_text_) through unchanged in prose", () => {
    const md = serializeToMarkdown(
      makeOpts({
        sections: [section(null, [{ type: "prose", text: "_Note_ this." }])],
      })
    );
    expect(md).toContain("_Note_ this.");
  });

  it("serialises bullet blocks with - prefix per item", () => {
    const md = serializeToMarkdown(
      makeOpts({
        sections: [section(null, [{ type: "bullet", items: ["Alpha", "Beta"] }])],
      })
    );
    expect(md).toContain("- Alpha");
    expect(md).toContain("- Beta");
  });

  it("serialises numbered blocks with sequential numbers", () => {
    const md = serializeToMarkdown(
      makeOpts({
        sections: [section(null, [{ type: "numbered", items: ["First", "Second"] }])],
      })
    );
    expect(md).toContain("1. First");
    expect(md).toContain("2. Second");
  });
});

// ─── Section headings and page breaks ────────────────────────────────────────

describe("serializeToMarkdown — sections", () => {
  it("outputs section heading as # prefix", () => {
    const md = serializeToMarkdown(
      makeOpts({ sections: [section("Executive Summary", [])] })
    );
    expect(md).toContain("# Executive Summary");
  });

  it("outputs --- for sections with isPageBreak true", () => {
    const md = serializeToMarkdown(
      makeOpts({ sections: [section("Chapter", [], { isPageBreak: true })] })
    );
    expect(md).toContain("---");
  });

  it("does not output extra --- for sections without isPageBreak", () => {
    const md = serializeToMarkdown(
      makeOpts({ sections: [section("Intro", [], { isPageBreak: false })] })
    );
    // Only the frontmatter delimiters should be present (2 occurrences of ---)
    const count = (md.match(/^---$/gm) ?? []).length;
    expect(count).toBe(2); // open + close of frontmatter
  });

  it("skips sections with no heading and no blocks", () => {
    const md = serializeToMarkdown(makeOpts({ sections: [section(null, [])] }));
    // Should have frontmatter only — no extra content beyond it
    const lines = md.trim().split("\n");
    const afterFrontmatter = lines.slice(lines.lastIndexOf("---") + 1).join("\n").trim();
    expect(afterFrontmatter).toBe("");
  });
});

// ─── Structured data serialisation ───────────────────────────────────────────

describe("serializeToMarkdown — structured data", () => {
  it("serialises accepted themes as bold labels", () => {
    const md = serializeToMarkdown(
      makeOpts({
        sections: [
          section("Key Themes", [], {
            isPageBreak: true,
            data: {
              kind: "themes",
              themes: [
                { label: "Governance", description: null, status: "accepted", memberCount: 3 },
              ],
            },
          }),
        ],
      })
    );
    expect(md).toContain("**Governance**");
    expect(md).not.toContain("pending review");
  });

  it("marks draft themes with (pending review)", () => {
    const md = serializeToMarkdown(
      makeOpts({
        sections: [
          section("Key Themes", [], {
            data: {
              kind: "themes",
              themes: [
                { label: "Draft Theme", description: null, status: "draft", memberCount: 1 },
              ],
            },
          }),
        ],
      })
    );
    expect(md).toContain("_(pending review)_");
  });

  it("marks rejected themes with (rejected)", () => {
    const md = serializeToMarkdown(
      makeOpts({
        sections: [
          section("Rejected Themes", [], {
            data: {
              kind: "themes",
              themes: [
                { label: "Dropped", description: null, status: "rejected", memberCount: 0 },
              ],
            },
          }),
        ],
      })
    );
    expect(md).toContain("_(rejected)_");
  });

  it("serialises theme description when present", () => {
    const md = serializeToMarkdown(
      makeOpts({
        sections: [
          section("Key Themes", [], {
            data: {
              kind: "themes",
              themes: [
                {
                  label: "Communication",
                  description: "About how teams communicate.",
                  status: "accepted",
                  memberCount: 2,
                },
              ],
            },
          }),
        ],
      })
    );
    expect(md).toContain("About how teams communicate.");
  });

  it("serialises evidence consultations as bold titles", () => {
    const md = serializeToMarkdown(
      makeOpts({
        sections: [
          section("Source Evidence", [], {
            data: {
              kind: "evidence",
              consultations: [
                { title: "Interview with Alice", date: "2026-01-10", people: ["Alice Smith"] },
              ],
            },
          }),
        ],
      })
    );
    expect(md).toContain("**Interview with Alice**");
    expect(md).toContain("Alice Smith");
  });

  it("serialises audit events as bullet lines", () => {
    const md = serializeToMarkdown(
      makeOpts({
        sections: [
          section("Audit Trail", [], {
            data: {
              kind: "audit",
              events: [
                { label: "Report generated", count: 1, createdAt: "2026-01-15T10:00:00Z" },
                { label: "Report edited", count: 3, createdAt: "2026-01-16T09:00:00Z" },
              ],
            },
          }),
        ],
      })
    );
    expect(md).toContain("- **Report generated**");
    expect(md).toContain("- **Report edited** (×3)");
  });

  it("omits count suffix when count is 1", () => {
    const md = serializeToMarkdown(
      makeOpts({
        sections: [
          section("Audit Trail", [], {
            data: {
              kind: "audit",
              events: [{ label: "Report generated", count: 1, createdAt: "2026-01-15T10:00:00Z" }],
            },
          }),
        ],
      })
    );
    expect(md).not.toContain("×1");
  });
});
