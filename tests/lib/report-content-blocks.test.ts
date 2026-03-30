import { describe, expect, it } from "vitest";
import { parseContentBlocks, type ContentBlock } from "@/lib/report-content-blocks";

describe("lib/report-content-blocks - parseContentBlocks", () => {
  // ─── Empty / trivial inputs ──────────────────────────────────────────────

  it("returns empty array for empty string", () => {
    expect(parseContentBlocks("")).toEqual([]);
  });

  it("returns empty array for whitespace-only string", () => {
    expect(parseContentBlocks("   \n\n  ")).toEqual([]);
  });

  // ─── Plain prose ─────────────────────────────────────────────────────────

  it("returns a single prose block for plain paragraph", () => {
    const result = parseContentBlocks("This is a paragraph.");
    expect(result).toEqual<ContentBlock[]>([
      { type: "prose", text: "This is a paragraph." },
    ]);
  });

  it("separates two paragraphs divided by a blank line", () => {
    const result = parseContentBlocks("First paragraph.\n\nSecond paragraph.");
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ type: "prose", text: "First paragraph." });
    expect(result[1]).toEqual({ type: "prose", text: "Second paragraph." });
  });

  it("joins consecutive non-blank prose lines into one block", () => {
    const result = parseContentBlocks("Line one\nLine two\nLine three");
    expect(result).toEqual<ContentBlock[]>([
      { type: "prose", text: "Line one Line two Line three" },
    ]);
  });

  // ─── Headings ────────────────────────────────────────────────────────────

  it("parses # heading as heading1", () => {
    const result = parseContentBlocks("# My Title");
    expect(result).toEqual<ContentBlock[]>([{ type: "heading1", text: "My Title" }]);
  });

  it("parses ## heading as heading2", () => {
    const result = parseContentBlocks("## Section Heading");
    expect(result).toEqual<ContentBlock[]>([{ type: "heading2", text: "Section Heading" }]);
  });

  it("parses ### heading as heading3", () => {
    const result = parseContentBlocks("### Sub-section");
    expect(result).toEqual<ContentBlock[]>([{ type: "heading3", text: "Sub-section" }]);
  });

  it("#hashtag is NOT treated as a heading (requires trailing space)", () => {
    const result = parseContentBlocks("#hashtag is a word");
    expect(result[0].type).toBe("prose");
  });

  it("##NoSpace is NOT treated as heading2", () => {
    const result = parseContentBlocks("##NoSpace");
    expect(result[0].type).toBe("prose");
  });

  it("###NoSpace is NOT treated as heading3", () => {
    const result = parseContentBlocks("###NoSpace");
    expect(result[0].type).toBe("prose");
  });

  // ─── Core fix: heading + bullets with single newline separator ───────────

  it("heading directly above bullets (single newline) → separate heading + bullet blocks", () => {
    const content = "## Key Findings\n- Finding one\n- Finding two";
    const result = parseContentBlocks(content);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ type: "heading2", text: "Key Findings" });
    expect(result[1]).toEqual({ type: "bullet", items: ["Finding one", "Finding two"] });
  });

  it("heading immediately adjacent to bullet (zero newlines between) works correctly", () => {
    const content = "# Title\n- Item A\n- Item B\n\n## Section\n- Item C";
    const result = parseContentBlocks(content);

    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({ type: "heading1", text: "Title" });
    expect(result[1]).toEqual({ type: "bullet", items: ["Item A", "Item B"] });
    expect(result[2]).toEqual({ type: "heading2", text: "Section" });
    expect(result[3]).toEqual({ type: "bullet", items: ["Item C"] });
  });

  it("prose paragraph followed immediately by heading (single newline) → two blocks", () => {
    const content = "Some introduction text.\n## The Heading\nMore prose.";
    const result = parseContentBlocks(content);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ type: "prose", text: "Some introduction text." });
    expect(result[1]).toEqual({ type: "heading2", text: "The Heading" });
    expect(result[2]).toEqual({ type: "prose", text: "More prose." });
  });

  // ─── Bullet lists ────────────────────────────────────────────────────────

  it("parses dash-prefixed lines as a bullet block", () => {
    const result = parseContentBlocks("- Alpha\n- Beta\n- Gamma");
    expect(result).toEqual<ContentBlock[]>([
      { type: "bullet", items: ["Alpha", "Beta", "Gamma"] },
    ]);
  });

  it("parses bullet-prefixed lines (•) as a bullet block", () => {
    const result = parseContentBlocks("• First\n• Second");
    expect(result).toEqual<ContentBlock[]>([
      { type: "bullet", items: ["First", "Second"] },
    ]);
  });

  it("parses asterisk-prefixed lines as a bullet block", () => {
    const result = parseContentBlocks("* One\n* Two");
    expect(result).toEqual<ContentBlock[]>([
      { type: "bullet", items: ["One", "Two"] },
    ]);
  });

  // ─── Numbered lists ──────────────────────────────────────────────────────

  it("parses digit-dot-space lines as a numbered block", () => {
    const result = parseContentBlocks("1. First item\n2. Second item\n3. Third item");
    expect(result).toEqual<ContentBlock[]>([
      { type: "numbered", items: ["First item", "Second item", "Third item"] },
    ]);
  });

  // ─── Mixed content (core bug scenario) ───────────────────────────────────

  it("mixed prose + bullets → separate prose and bullet blocks", () => {
    const content = "Intro sentence.\n\n- Bullet A\n- Bullet B\n\nConclusion.";
    const result = parseContentBlocks(content);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ type: "prose", text: "Intro sentence." });
    expect(result[1]).toEqual({ type: "bullet", items: ["Bullet A", "Bullet B"] });
    expect(result[2]).toEqual({ type: "prose", text: "Conclusion." });
  });

  it("bullet list immediately followed by prose (single newline) → two blocks", () => {
    const content = "- Item one\n- Item two\nFollowing prose.";
    const result = parseContentBlocks(content);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ type: "bullet", items: ["Item one", "Item two"] });
    expect(result[1]).toEqual({ type: "prose", text: "Following prose." });
  });

  // ─── Full AI-style report content ────────────────────────────────────────

  it("handles realistic AI report content correctly end-to-end", () => {
    const content = `## Executive Summary
This report covers three key themes identified across five consultations.

### Key Themes
- **Workload pressure** was reported by 4 of 5 participants
- Communication breakdowns in team meetings
- Unclear role boundaries

## Recommendations
1. Review workload distribution quarterly
2. Introduce structured meeting agendas
3. Clarify reporting lines by end of Q2`;

    const result = parseContentBlocks(content);

    expect(result[0]).toEqual({ type: "heading2", text: "Executive Summary" });
    expect(result[1]).toEqual({
      type: "prose",
      text: "This report covers three key themes identified across five consultations.",
    });
    expect(result[2]).toEqual({ type: "heading3", text: "Key Themes" });
    expect(result[3].type).toBe("bullet");
    expect((result[3] as { type: "bullet"; items: string[] }).items).toHaveLength(3);
    expect(result[4]).toEqual({ type: "heading2", text: "Recommendations" });
    expect(result[5].type).toBe("numbered");
    expect((result[5] as { type: "numbered"; items: string[] }).items).toHaveLength(3);
  });
});
