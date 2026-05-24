/**
 * Server-side canvas → PNG renderer.
 *
 * Renders the consultant's canvas from the persisted state into a PNG per
 * frame. No browser DOM, no html2canvas — we build an SVG that mimics the
 * live canvas card design and rasterise via @resvg/resvg-js.
 *
 * Pipeline:
 *   composeCanvasState() → CanvasNode[] + CanvasEdge[] + CanvasFrame[]
 *   → SVG string per frame → resvg → PNG buffer → base64 data URL.
 *
 * Card design is hand-coded to mirror the live components (canvas-node-card.tsx
 * for theme groups + insights, canvas-frame-node.tsx for frames). When the
 * live styles change, this renderer needs an update — keep the constants in
 * sync with `lib/canvas-layout.ts` and `components/canvas/canvas-frame-node.tsx`.
 *
 * No hero / full-canvas image is produced. The user explicitly does not want
 * one — only per-frame imagery, contextual to each section.
 */
import { Resvg, initWasm } from "@resvg/resvg-wasm";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  CONNECTION_COLORS,
  CONNECTION_TYPE_LABELS,
  DASHED_CONNECTION_TYPES,
} from "@/lib/canvas-constants";
import type { CanvasNode, CanvasEdge, CanvasFrame, FrameColor } from "@/types/canvas";

// ─── Layout constants (mirror lib/canvas-layout.ts) ──────────────────────────

const GROUP_WIDTH = 596;
const GROUP_HEADER_HEIGHT = 118;
const GROUP_PADDING_X = 28;
const GROUP_PADDING_TOP = 24;
const GROUP_PADDING_BOTTOM = 28;
const GROUP_GAP_Y = 22;
const GROUP_COLUMNS = 2;
const INSIGHT_WIDTH = 258;
const INSIGHT_HEIGHT = 110;
const GROUP_GAP_X = 24;

function getGroupHeight(memberCount: number) {
  const visibleCount = Math.max(memberCount, 1);
  const rowCount = Math.max(1, Math.ceil(visibleCount / GROUP_COLUMNS));
  return Math.max(
    246,
    GROUP_HEADER_HEIGHT +
      GROUP_PADDING_TOP +
      GROUP_PADDING_BOTTOM +
      rowCount * INSIGHT_HEIGHT +
      Math.max(0, rowCount - 1) * GROUP_GAP_Y
  );
}

// ─── Visual constants ────────────────────────────────────────────────────────

// Mapping of FrameColor → Tailwind 500-shade hex. Keeps the report visual
// in sync with the live canvas palette (lib/canvas-frame-node.tsx COLOR_CLASSES).
const FRAME_COLOR_HEX: Record<FrameColor, string> = {
  amber: "#f59e0b",
  blue: "#3b82f6",
  green: "#10b981", // Tailwind emerald-500 — the canvas uses emerald for "green".
  purple: "#8b5cf6", // Tailwind violet-500
  rose: "#f43f5e",
  slate: "#64748b",
};

const CARD_BG = "#ffffff";
const CARD_BORDER = "#e4e4e7"; // zinc-200, matches border/80
const CARD_RADIUS = 24;
const INSIGHT_RADIUS = 16;
const TEXT_PRIMARY = "#111827"; // gray-900
const TEXT_MUTED = "#6b7280"; // gray-500
const TEXT_SUBTLE = "#9ca3af"; // gray-400
const ACCEPTED_DOT = "#10b981"; // emerald-500
const PENDING_DOT = "#d4d4d8"; // zinc-300
const FRAME_FILL_OPACITY = 0.08; // matches /8 Tailwind alpha
const FRAME_BORDER_OPACITY = 0.6; // matches /60
// Single font name — matches the buffer we hand to Resvg (Noto Sans, loaded
// from the @vercel/og copy bundled with Next.js). Compound declarations
// confuse the fallback chain and produce missing-glyph boxes in punctuation.
const FONT_FAMILY = `Noto Sans`;
// Use ASCII ellipsis (three dots) instead of the U+2026 single-glyph "…" —
// many of the fonts resvg falls back to lack that codepoint and render it as
// junk overlapping the line above.
const ELLIPSIS = "...";
const PADDING = 64;
const FRAME_HEADER_PILL_OFFSET = 14;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Rough sans-serif glyph width estimate (≈0.55em). */
function approxTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.55;
}

/**
 * Greedy word-wrap into `maxLines` lines, each clipped to `maxWidth`. Returns
 * the lines with ellipsis on the last when overflowing.
 */
function wrapText(text: string, fontSize: number, maxWidth: number, maxLines: number): string[] {
  if (!text) return [];
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const trial = current ? `${current} ${word}` : word;
    if (approxTextWidth(trial, fontSize) <= maxWidth) {
      current = trial;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length >= maxLines) break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines) {
    // Re-clip the last line with ellipsis if the remaining input would have spilled.
    const tail = lines[maxLines - 1];
    if (tail && approxTextWidth(tail, fontSize) > maxWidth) {
      lines[maxLines - 1] = clipLabel(tail, maxWidth, fontSize);
    }
  }
  return lines;
}

function clipLabel(label: string, maxWidth: number, fontSize: number): string {
  if (approxTextWidth(label, fontSize) <= maxWidth) return label;
  let lo = 0;
  let hi = label.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (approxTextWidth(label.slice(0, mid) + ELLIPSIS, fontSize) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return label.slice(0, lo) + ELLIPSIS;
}

/** Normalize text to characters resvg's font fallback handles cleanly. */
function sanitizeForRender(text: string): string {
  return text
    .replace(/…/g, "...")
    .replace(/—/g, "-") // em-dash
    .replace(/–/g, "-") // en-dash
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"');
}

interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// ─── Card SVG ────────────────────────────────────────────────────────────────

function svgInsightCard(node: CanvasNode, x: number, y: number, w = INSIGHT_WIDTH, h = INSIGHT_HEIGHT): string {
  const labelLines = wrapText(sanitizeForRender(node.label.trim() || "(unnamed)"), 13, w - 24, 2);
  const descLines = node.description
    ? wrapText(sanitizeForRender(node.description.trim()), 11, w - 24, 2)
    : [];
  const dotColor = node.accepted ? ACCEPTED_DOT : PENDING_DOT;

  const sourceLabel =
    node.sourceType === "research"
      ? node.researchReferenceLabel ?? null
      : node.sourceConsultationTitle ?? null;
  const sourceText = sourceLabel
    ? clipLabel(sanitizeForRender(`1-1 with ${sourceLabel}`), w - 24, 11)
    : null;

  let cursor = y + 18;
  const parts: string[] = [];
  parts.push(
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${INSIGHT_RADIUS}" fill="${CARD_BG}" stroke="${CARD_BORDER}" stroke-width="1"/>`,
    `<circle cx="${x + w - 14}" cy="${y + 14}" r="4" fill="${dotColor}"/>`
  );
  for (const line of labelLines) {
    parts.push(
      `<text x="${x + 12}" y="${cursor}" font-family='${FONT_FAMILY}' font-size="13" font-weight="600" fill="${TEXT_PRIMARY}">${escapeXml(line)}</text>`
    );
    cursor += 16;
  }
  cursor += 2;
  for (const line of descLines) {
    parts.push(
      `<text x="${x + 12}" y="${cursor}" font-family='${FONT_FAMILY}' font-size="11" fill="${TEXT_MUTED}">${escapeXml(line)}</text>`
    );
    cursor += 14;
  }
  if (sourceText) {
    parts.push(
      `<rect x="${x + 12}" y="${y + h - 26}" width="${approxTextWidth(sourceText, 10) + 12}" height="18" rx="9" fill="#fef3c7"/>`,
      `<text x="${x + 18}" y="${y + h - 13}" font-family='${FONT_FAMILY}' font-size="10" fill="#92400e">${escapeXml(sourceText)}</text>`
    );
  }
  return parts.join("");
}

function svgThemeGroupCard(node: CanvasNode, x: number, y: number, members: CanvasNode[]): string {
  const w = GROUP_WIDTH;
  const h = getGroupHeight(node.memberIds.length);
  const labelLines = wrapText(
    sanitizeForRender(node.label.trim() || "Theme group"),
    16,
    w - 56 - 80,
    2
  );
  const descLines = node.description
    ? wrapText(sanitizeForRender(node.description.trim()), 12, w - 56 - 80, 3)
    : [];

  const parts: string[] = [];
  // Outer card with rounded corners + thin border + emerald left stripe.
  parts.push(
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${CARD_RADIUS}" fill="${CARD_BG}" stroke="${CARD_BORDER}" stroke-width="1"/>`,
    // Left accent stripe — clamp rx to width/2 so resvg doesn't panic on the
    // geometry (a 6px-wide rect with rx=24 has rx > width/2 = invalid).
    `<rect x="${x}" y="${y}" width="6" height="${h}" rx="3" fill="#10b981" fill-opacity="0.7"/>`
  );

  // Header section (label + description + member-count badge).
  let cursor = y + 32;
  for (const line of labelLines) {
    parts.push(
      `<text x="${x + 28}" y="${cursor}" font-family='${FONT_FAMILY}' font-size="16" font-weight="600" fill="${TEXT_PRIMARY}">${escapeXml(line)}</text>`
    );
    cursor += 20;
  }
  cursor += 4;
  for (const line of descLines) {
    parts.push(
      `<text x="${x + 28}" y="${cursor}" font-family='${FONT_FAMILY}' font-size="12" fill="${TEXT_MUTED}">${escapeXml(line)}</text>`
    );
    cursor += 16;
  }
  // Member-count badge top-right.
  const badge = `${node.memberIds.length} card${node.memberIds.length === 1 ? "" : "s"}`;
  const badgeW = approxTextWidth(badge, 11) + 18;
  parts.push(
    `<rect x="${x + w - badgeW - 18}" y="${y + 20}" width="${badgeW}" height="22" rx="11" fill="#f4f4f5"/>`,
    `<text x="${x + w - badgeW / 2 - 18}" y="${y + 35}" font-family='${FONT_FAMILY}' font-size="11" fill="${TEXT_MUTED}" text-anchor="middle">${escapeXml(badge)}</text>`
  );

  // Divider under header.
  parts.push(
    `<line x1="${x + 28}" y1="${y + GROUP_HEADER_HEIGHT}" x2="${x + w - 28}" y2="${y + GROUP_HEADER_HEIGHT}" stroke="${CARD_BORDER}"/>`
  );

  // Member cards laid out 2-up like the live canvas.
  members.slice(0, node.memberIds.length).forEach((member, index) => {
    const row = Math.floor(index / GROUP_COLUMNS);
    const col = index % GROUP_COLUMNS;
    const cardX = x + GROUP_PADDING_X + col * (INSIGHT_WIDTH + GROUP_GAP_X);
    const cardY =
      y + GROUP_HEADER_HEIGHT + GROUP_PADDING_TOP + row * (INSIGHT_HEIGHT + GROUP_GAP_Y);
    parts.push(svgInsightCard(member, cardX, cardY));
  });

  return parts.join("");
}

function svgFrame(frame: CanvasFrame): string {
  const colorHex = FRAME_COLOR_HEX[frame.color] ?? FRAME_COLOR_HEX.blue;
  const parts: string[] = [];
  // Filled rounded rect with tinted background + coloured border.
  parts.push(
    `<rect x="${frame.x}" y="${frame.y}" width="${frame.width}" height="${frame.height}" rx="14" ` +
      `fill="${colorHex}" fill-opacity="${FRAME_FILL_OPACITY}" ` +
      `stroke="${colorHex}" stroke-opacity="${FRAME_BORDER_OPACITY}" stroke-width="2"/>`
  );
  // Floating header pill (top-left, slightly above the frame edge — mirrors
  // canvas-frame-node.tsx -top-3 left-3 absolute positioning).
  const pillText = sanitizeForRender(frame.name || "Frame");
  const textW = approxTextWidth(pillText, 12);
  const pillW = textW + 32;
  const pillH = 22;
  const pillX = frame.x + FRAME_HEADER_PILL_OFFSET;
  const pillY = frame.y - pillH / 2;
  parts.push(
    `<rect x="${pillX}" y="${pillY}" width="${pillW}" height="${pillH}" rx="6" fill="${CARD_BG}" stroke="${CARD_BORDER}"/>`,
    `<circle cx="${pillX + 12}" cy="${pillY + pillH / 2}" r="4" fill="${colorHex}"/>`,
    `<text x="${pillX + 22}" y="${pillY + 15}" font-family='${FONT_FAMILY}' font-size="12" font-weight="500" fill="${TEXT_PRIMARY}">${escapeXml(pillText)}</text>`
  );
  return parts.join("");
}

// ─── Edge SVG ────────────────────────────────────────────────────────────────

interface NodeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function rectFor(node: CanvasNode): NodeRect {
  if (node.type === "theme") {
    return {
      x: node.position.x,
      y: node.position.y,
      width: GROUP_WIDTH,
      height: getGroupHeight(node.memberIds.length),
    };
  }
  return {
    x: node.position.x,
    y: node.position.y,
    width: INSIGHT_WIDTH,
    height: INSIGHT_HEIGHT,
  };
}

/** Match ReactFlow default bezier: emit right edge of source → left edge of target. */
function handlePoints(src: NodeRect, tgt: NodeRect) {
  return {
    sx: src.x + src.width,
    sy: src.y + 24, // theme cards have top-12 handles; insights use vertical center-ish
    tx: tgt.x,
    ty: tgt.y + 24,
  };
}

function svgEdgePath(edge: CanvasEdge, source: CanvasNode, target: CanvasNode): string {
  const { sx, sy, tx, ty } = handlePoints(rectFor(source), rectFor(target));
  const color = CONNECTION_COLORS[edge.connection_type] ?? "#6b7280";
  const dash = DASHED_CONNECTION_TYPES.has(edge.connection_type) ? "6 4" : "0";

  // Bezier control-point offset — matches React Flow's "smoothstep"/"bezier"
  // default where curvature scales with horizontal distance.
  const dx = Math.max(40, Math.abs(tx - sx) * 0.5);
  const cp1x = sx + dx;
  const cp1y = sy;
  const cp2x = tx - dx;
  const cp2y = ty;

  const mx = 0.125 * sx + 0.375 * cp1x + 0.375 * cp2x + 0.125 * tx;
  const my = 0.125 * sy + 0.375 * cp1y + 0.375 * cp2y + 0.125 * ty;
  const label = CONNECTION_TYPE_LABELS[edge.connection_type];
  const labelW = approxTextWidth(label, 10) + 14;

  return (
    `<path d="M ${sx} ${sy} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${tx} ${ty}" ` +
    `fill="none" stroke="${color}" stroke-width="2.5" stroke-dasharray="${dash}" ` +
    `marker-end="url(#arrow-${edge.connection_type})"/>` +
    `<rect x="${mx - labelW / 2}" y="${my - 10}" width="${labelW}" height="18" rx="9" fill="${CARD_BG}" fill-opacity="0.94"/>` +
    `<text x="${mx}" y="${my + 4}" font-family='${FONT_FAMILY}' font-size="10" fill="${color}" text-anchor="middle">${escapeXml(label)}</text>`
  );
}

function svgArrowDefs(): string {
  const types = [
    "causes",
    "influences",
    "supports",
    "contradicts",
    "context",
    "related_to",
  ] as const;
  return (
    `<defs>` +
    types
      .map(
        (t) =>
          `<marker id="arrow-${t}" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto" markerUnits="strokeWidth">` +
          `<path d="M 0 0 L 10 5 L 0 10 z" fill="${CONNECTION_COLORS[t]}"/>` +
          `</marker>`
      )
      .join("") +
    `</defs>`
  );
}

// ─── WASM init ───────────────────────────────────────────────────────────────

// @resvg/resvg-wasm needs the WASM blob loaded once before `new Resvg(...)`.
// We read it from disk at runtime (not bundled) so Turbopack / webpack don't
// need to handle the binary. node_modules layout is stable enough across
// package managers (bun, npm, pnpm) for this path to resolve in production.
let wasmInitPromise: Promise<void> | null = null;
function ensureWasmInitialised(): Promise<void> {
  if (!wasmInitPromise) {
    wasmInitPromise = (async () => {
      const wasmPath = join(
        process.cwd(),
        "node_modules/@resvg/resvg-wasm/index_bg.wasm"
      );
      const wasmBuffer = await readFile(wasmPath);
      await initWasm(wasmBuffer);
    })();
  }
  return wasmInitPromise;
}

// resvg-wasm has no access to system fonts — text in SVG renders as empty
// boxes unless we explicitly pass a font buffer. Next.js bundles a Noto
// Sans TTF via `@vercel/og` (used for OG image generation); we piggyback
// on that so we don't have to vendor our own font file. Path is stable
// across Next 14/15.
let fontPromise: Promise<Uint8Array> | null = null;
function loadFont(): Promise<Uint8Array> {
  if (!fontPromise) {
    fontPromise = (async () => {
      const fontPath = join(
        process.cwd(),
        "node_modules/next/dist/compiled/@vercel/og/noto-sans-v27-latin-regular.ttf"
      );
      const buf = await readFile(fontPath);
      return new Uint8Array(buf);
    })();
  }
  return fontPromise;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface CanvasRenderInput {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  frames: CanvasFrame[];
}

/** Treat a frame as renderable only if it has positive, finite dimensions. */
function isFrameRenderable(frame: CanvasFrame): boolean {
  return (
    Number.isFinite(frame.x) &&
    Number.isFinite(frame.y) &&
    Number.isFinite(frame.width) &&
    Number.isFinite(frame.height) &&
    frame.width >= 40 &&
    frame.height >= 40
  );
}

/**
 * Render a single frame as a PNG data URL. Returns null on failure or when
 * the frame has degenerate dimensions.
 *
 * Viewport: clipped to the frame's bbox + padding. Edges that exit the frame
 * render only their visible portion (clipped naturally by SVG viewBox).
 */
async function renderFrameToPng(
  input: CanvasRenderInput,
  frame: CanvasFrame,
  maxWidth: number
): Promise<string | null> {
  if (!isFrameRenderable(frame)) return null;
  const frameRect = {
    minX: frame.x,
    minY: frame.y,
    maxX: frame.x + frame.width,
    maxY: frame.y + frame.height,
  };
  // Pad slightly so the frame header pill + border are not clipped.
  const minX = frameRect.minX - 32;
  const minY = frameRect.minY - 32;
  const w = frame.width + 64;
  const h = frame.height + 64;

  const nodeById = new Map(input.nodes.map((n) => [n.id, n] as const));

  // Theme-group memberships — show all member insight cards inside their
  // parent theme card. We still draw insight nodes that are NOT inside any
  // group as standalone cards.
  const memberIdsClaimed = new Set<string>();
  for (const node of input.nodes) {
    if (node.type === "theme") {
      for (const id of node.memberIds) memberIdsClaimed.add(id);
    }
  }

  // Decide which nodes are "visible" in this frame: anything whose bbox
  // overlaps the frame's bbox. Members of a theme group are rendered with
  // their parent (not as standalone), so we filter those out.
  const visibleStandaloneNodes = input.nodes.filter((node) => {
    if (memberIdsClaimed.has(node.id)) return false;
    const r = rectFor(node);
    return (
      r.x + r.width > frameRect.minX &&
      r.x < frameRect.maxX &&
      r.y + r.height > frameRect.minY &&
      r.y < frameRect.maxY
    );
  });

  const visibleEdges = input.edges.filter(
    (e) => nodeById.has(e.source_node_id) && nodeById.has(e.target_node_id)
  );

  const parts: string[] = [];
  parts.push(svgArrowDefs());
  parts.push(
    `<rect x="${minX}" y="${minY}" width="${w}" height="${h}" fill="#fafafa"/>`
  );
  // Draw the frame's chrome first so cards sit on top.
  parts.push(svgFrame(frame));

  // Draw edges between the visible standalone-or-theme nodes.
  for (const edge of visibleEdges) {
    const source = nodeById.get(edge.source_node_id)!;
    const target = nodeById.get(edge.target_node_id)!;
    parts.push(svgEdgePath(edge, source, target));
  }

  // Draw cards.
  for (const node of visibleStandaloneNodes) {
    if (node.type === "theme") {
      const members = node.memberIds
        .map((id) => nodeById.get(id))
        .filter((m): m is CanvasNode => Boolean(m));
      parts.push(svgThemeGroupCard(node, node.position.x, node.position.y, members));
    } else {
      parts.push(svgInsightCard(node, node.position.x, node.position.y));
    }
  }

  if (visibleStandaloneNodes.length === 0) {
    // Empty frame — still emit the chrome so the report shows the frame
    // outline rather than "No captured image".
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${w} ${h}">` +
    parts.join("") +
    `</svg>`;

  try {
    await ensureWasmInitialised();
    const fontBuffer = await loadFont();
    const resvg = new Resvg(svg, {
      fitTo: { mode: "width", value: maxWidth },
      background: "#fafafa",
      font: {
        fontBuffers: [fontBuffer],
        loadSystemFonts: false,
        defaultFontFamily: "Noto Sans",
      },
    });
    const png = resvg.render().asPng();
    return `data:image/png;base64,${Buffer.from(png).toString("base64")}`;
  } catch (error) {
    console.warn("[canvas-svg-renderer] frame render failed", frame.id, error);
    return null;
  }
}

/**
 * Render one PNG per frame and return the persistence-ready payload.
 *
 * No full / hero image is produced — only per-frame imagery. Returns null
 * when there are no frames at all (caller should leave canvas_image unset).
 */
export async function renderCanvasImagePayload(
  input: CanvasRenderInput,
  opts: { perFrameMaxWidth?: number } = {}
): Promise<{ full: string | null; frames: Record<string, string>; capturedAt: string } | null> {
  if (input.frames.length === 0) return null;

  const perFrameMaxWidth = opts.perFrameMaxWidth ?? 1200;
  const frames: Record<string, string> = {};
  for (const frame of input.frames) {
    const dataUrl = await renderFrameToPng(input, frame, perFrameMaxWidth);
    if (dataUrl) frames[frame.id] = dataUrl;
  }
  if (Object.keys(frames).length === 0) return null;

  return {
    // No hero image — `full` stays null. The shape is preserved for backward
    // compatibility with any existing readers that may dereference it.
    full: null,
    frames,
    capturedAt: new Date().toISOString(),
  };
}
