import {
  decodeReportMarkdownEntities,
  normalizeReportHeadingText,
} from "@/lib/report-editor-markdown";

// ─── Report Content Block Parser ──────────────────────────────────────────────
//
// Pure line-by-line state machine that converts markdown report content into a
// flat array of typed blocks.  No React dependencies — importable from both the
// web renderer and the PDF renderer.
//
// Rules (in priority order, evaluated per non-blank line):
//   1. "### text"  →  heading3  (requires trailing space after ###)
//   2. "## text"   →  heading2  (requires trailing space after ##)
//   3. "# text"    →  heading1  (requires trailing space after # — prevents #hashtag)
//   4. "- " / "• " / "* "  →  bullet item (accumulates into current bullet block)
//   5. /^\d+\.\s/           →  numbered item (accumulates into current numbered block)
//   6. blank line           →  flushes the current block
//   7. anything else        →  prose line (accumulates into current prose block)
//
// Adjacent lines of the same block type accumulate without requiring blank
// separators (e.g. headings directly above bullets work correctly).
// Different types always start a new block, flushing the previous one.

export type ContentBlock =
  | { type: "heading1"; text: string }
  | { type: "heading2"; text: string }
  | { type: "heading3"; text: string }
  | { type: "bullet"; items: string[] }
  | { type: "numbered"; items: string[] }
  | { type: "prose"; text: string };

type MutableBlock =
  | { type: "heading1"; text: string }
  | { type: "heading2"; text: string }
  | { type: "heading3"; text: string }
  | { type: "bullet"; items: string[] }
  | { type: "numbered"; items: string[] }
  | { type: "prose"; lines: string[] };

function isBulletLine(line: string): boolean {
  const t = line.trim();
  return t.startsWith("- ") || t.startsWith("\u2022 ") || t.startsWith("* ");
}

function isNumberedLine(line: string): boolean {
  return /^\s*\d+\.\s/.test(line);
}

function stripBulletPrefix(line: string): string {
  return line.replace(/^[\s]*[-\u2022*]\s*/, "");
}

function stripNumberedPrefix(line: string): string {
  return line.replace(/^\s*\d+\.\s*/, "");
}

function blockType(b: MutableBlock): string {
  return b.type;
}

function finalize(b: MutableBlock): ContentBlock {
  if (b.type === "prose") {
    return { type: "prose", text: b.lines.join(" ") };
  }
  return b as ContentBlock;
}

/**
 * Parse markdown report content into a flat array of typed `ContentBlock`s.
 *
 * @param content  Raw markdown string (may contain single or double newlines)
 * @returns        Ordered array of blocks ready for rendering
 */
export function parseContentBlocks(content: string): ContentBlock[] {
  if (!content || !content.trim()) return [];

  const lines = content.split("\n");
  const results: ContentBlock[] = [];
  let current: MutableBlock | null = null;

  function flush() {
    if (!current) return;
    results.push(finalize(current));
    current = null;
  }

  for (const line of lines) {
    const normalizedLine = decodeReportMarkdownEntities(line);
    const trimmed = normalizedLine.trim();

    // Blank line → flush current block
    if (!trimmed) {
      flush();
      continue;
    }

    // ── Headings (must have a trailing space after #/##/### to avoid #hashtag) ──
    if (trimmed.startsWith("### ")) {
      flush();
      results.push({ type: "heading3", text: normalizeReportHeadingText(trimmed.slice(4)) });
      current = null;
      continue;
    }
    if (trimmed.startsWith("## ")) {
      flush();
      results.push({ type: "heading2", text: normalizeReportHeadingText(trimmed.slice(3)) });
      current = null;
      continue;
    }
    if (trimmed.startsWith("# ")) {
      flush();
      results.push({ type: "heading1", text: normalizeReportHeadingText(trimmed.slice(2)) });
      current = null;
      continue;
    }

    // ── Bullet list ──────────────────────────────────────────────────────────
    if (isBulletLine(normalizedLine)) {
      const item = stripBulletPrefix(normalizedLine).trim();
      if (current && blockType(current) === "bullet") {
        (current as { type: "bullet"; items: string[] }).items.push(item);
      } else {
        flush();
        current = { type: "bullet", items: [item] };
      }
      continue;
    }

    // ── Numbered list ────────────────────────────────────────────────────────
    if (isNumberedLine(normalizedLine)) {
      const item = stripNumberedPrefix(normalizedLine).trim();
      if (current && blockType(current) === "numbered") {
        (current as { type: "numbered"; items: string[] }).items.push(item);
      } else {
        flush();
        current = { type: "numbered", items: [item] };
      }
      continue;
    }

    // ── Prose ────────────────────────────────────────────────────────────────
    if (current && blockType(current) === "prose") {
      (current as { type: "prose"; lines: string[] }).lines.push(trimmed);
    } else {
      flush();
      current = { type: "prose", lines: [trimmed] };
    }
  }

  // Final flush
  flush();

  return results;
}
