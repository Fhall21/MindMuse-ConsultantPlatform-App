/**
 * Server-side canvas renderer.
 *
 * Produces a PNG of the consultant's canvas from already-persisted layout
 * data (positions, frames, edges, node labels) — no browser DOM required.
 *
 * Why this exists: report generation is triggered from pages where the
 * canvas isn't mounted (`/consultations/rounds/[id]`, `/reports`). To
 * preserve the canvas → report visual fidelity, we render the canvas
 * here, then store the result on the new report row.
 *
 * Pipeline:
 *   stored layout → handcrafted SVG string → @resvg/resvg-js → PNG buffer
 *   → base64 data URL → `canvas_image` jsonb.
 *
 * The render is a *clean diagram*, not a pixel-for-pixel screenshot. It
 * trades the live canvas's exact Tailwind chrome for predictability and
 * fits the report's print aesthetic better than a html2canvas dump would.
 */
import { Resvg } from "@resvg/resvg-js";
import {
  CONNECTION_COLORS,
  CONNECTION_TYPE_LABELS,
  DASHED_CONNECTION_TYPES,
} from "@/lib/canvas-constants";
import type { ConnectionType } from "@/types/canvas";

// ─── Input shape ──────────────────────────────────────────────────────────────

export interface CanvasRenderNode {
  id: string;
  label: string;
  /** Flow-space coordinates of the node's top-left corner. */
  x: number;
  y: number;
  /** Defaults applied if persisted layout doesn't carry them. */
  width?: number;
  height?: number;
}

export interface CanvasRenderEdge {
  sourceNodeId: string;
  targetNodeId: string;
  connectionType: ConnectionType;
  note?: string | null;
}

export interface CanvasRenderFrame {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Hex colour. Falls back to neutral grey when null. */
  color?: string | null;
}

export interface CanvasRenderInput {
  nodes: CanvasRenderNode[];
  edges: CanvasRenderEdge[];
  frames: CanvasRenderFrame[];
}

// ─── Rendering constants ──────────────────────────────────────────────────────

const NODE_WIDTH = 200;
const NODE_HEIGHT = 80;
const NODE_RADIUS = 8;
const NODE_FILL = "#ffffff";
const NODE_BORDER = "#d4d4d8";
const NODE_TEXT = "#1f2937";
const FRAME_FILL_OPACITY = 0.06;
const FRAME_BORDER_WIDTH = 2;
const PADDING = 60;
const FONT = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Approximate text width for our default font. resvg can't measure text up
 * front, and we don't want to ship a font file just for that — this is
 * good enough for label-truncation heuristics.
 */
function approxTextWidth(text: string, fontSize: number): number {
  // Average glyph width ≈ 0.55em for sans-serif body copy.
  return text.length * fontSize * 0.55;
}

/**
 * Truncate `label` so its rendered width fits inside `maxWidth`. Returns
 * the truncated string with an ellipsis suffix when needed.
 */
function clipLabel(label: string, maxWidth: number, fontSize: number): string {
  if (approxTextWidth(label, fontSize) <= maxWidth) return label;
  // Binary-search the cut point so we don't render off-card text.
  let lo = 0;
  let hi = label.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (approxTextWidth(label.slice(0, mid) + "…", fontSize) <= maxWidth) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return label.slice(0, lo) + "…";
}

interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function unionBBox(a: BBox, b: BBox): BBox {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

function computeBBox(input: CanvasRenderInput): BBox | null {
  let bbox: BBox | null = null;
  for (const node of input.nodes) {
    const w = node.width ?? NODE_WIDTH;
    const h = node.height ?? NODE_HEIGHT;
    const next: BBox = {
      minX: node.x,
      minY: node.y,
      maxX: node.x + w,
      maxY: node.y + h,
    };
    bbox = bbox ? unionBBox(bbox, next) : next;
  }
  for (const frame of input.frames) {
    const next: BBox = {
      minX: frame.x,
      minY: frame.y,
      maxX: frame.x + frame.width,
      maxY: frame.y + frame.height,
    };
    bbox = bbox ? unionBBox(bbox, next) : next;
  }
  return bbox;
}

// ─── SVG fragment builders ────────────────────────────────────────────────────

function svgFrame(frame: CanvasRenderFrame): string {
  const color = frame.color ?? "#94a3b8";
  return (
    `<g>` +
    `<rect x="${frame.x}" y="${frame.y}" width="${frame.width}" height="${frame.height}" rx="12" ` +
    `fill="${color}" fill-opacity="${FRAME_FILL_OPACITY}" ` +
    `stroke="${color}" stroke-width="${FRAME_BORDER_WIDTH}" stroke-opacity="0.5"/>` +
    `<rect x="${frame.x}" y="${frame.y - 22}" width="${Math.min(frame.width, approxTextWidth(frame.name, 12) + 16)}" height="22" rx="6" ` +
    `fill="${color}" fill-opacity="0.9"/>` +
    `<text x="${frame.x + 8}" y="${frame.y - 6}" font-size="12" fill="#ffffff" font-family="${FONT.split(",")[0]?.replace(/^\d+px /, "")}">` +
    escapeXml(frame.name) +
    `</text>` +
    `</g>`
  );
}

function svgNode(node: CanvasRenderNode): string {
  const w = node.width ?? NODE_WIDTH;
  const h = node.height ?? NODE_HEIGHT;
  const cx = node.x + w / 2;
  const cy = node.y + h / 2;
  // Two-line wrap: split on rough mid-point at a space if available.
  const label = node.label.trim() || "(unnamed)";
  const wrapWidth = w - 20;
  let line1 = label;
  let line2 = "";
  if (approxTextWidth(label, 13) > wrapWidth) {
    const half = Math.floor(label.length / 2);
    const splitIdx = label.indexOf(" ", half - 6);
    if (splitIdx > 0 && splitIdx < label.length - 4) {
      line1 = label.slice(0, splitIdx);
      line2 = label.slice(splitIdx + 1);
    }
    line1 = clipLabel(line1, wrapWidth, 13);
    line2 = clipLabel(line2, wrapWidth, 13);
  }
  const fontFamily = `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  return (
    `<g>` +
    `<rect x="${node.x}" y="${node.y}" width="${w}" height="${h}" rx="${NODE_RADIUS}" ` +
    `fill="${NODE_FILL}" stroke="${NODE_BORDER}" stroke-width="1"/>` +
    `<text x="${cx}" y="${line2 ? cy - 4 : cy + 4}" font-size="13" fill="${NODE_TEXT}" ` +
    `font-family='${fontFamily}' text-anchor="middle" dominant-baseline="middle">` +
    escapeXml(line1) +
    `</text>` +
    (line2
      ? `<text x="${cx}" y="${cy + 12}" font-size="13" fill="${NODE_TEXT}" ` +
        `font-family='${fontFamily}' text-anchor="middle" dominant-baseline="middle">` +
        escapeXml(line2) +
        `</text>`
      : "") +
    `</g>`
  );
}

interface NodeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function nodeRect(node: CanvasRenderNode): NodeRect {
  return {
    x: node.x,
    y: node.y,
    width: node.width ?? NODE_WIDTH,
    height: node.height ?? NODE_HEIGHT,
  };
}

/**
 * Pick handle points on the two nodes so edges don't enter through the
 * middle. Simple right-edge → left-edge heuristic: source emits on its
 * right, target receives on its left. Mirrors the live ReactFlow default
 * "smoothstep" topology.
 */
function handlePoints(src: NodeRect, tgt: NodeRect): { sx: number; sy: number; tx: number; ty: number } {
  return {
    sx: src.x + src.width,
    sy: src.y + src.height / 2,
    tx: tgt.x,
    ty: tgt.y + tgt.height / 2,
  };
}

function svgEdge(
  edge: CanvasRenderEdge,
  source: CanvasRenderNode,
  target: CanvasRenderNode
): string {
  const { sx, sy, tx, ty } = handlePoints(nodeRect(source), nodeRect(target));
  const color = CONNECTION_COLORS[edge.connectionType] ?? "#6b7280";
  const dash = DASHED_CONNECTION_TYPES.has(edge.connectionType) ? "6 4" : "0";
  const dx = Math.abs(tx - sx) * 0.5;
  const cp1x = sx + dx;
  const cp1y = sy;
  const cp2x = tx - dx;
  const cp2y = ty;
  const mx = 0.125 * sx + 0.375 * cp1x + 0.375 * cp2x + 0.125 * tx;
  const my = 0.125 * sy + 0.375 * cp1y + 0.375 * cp2y + 0.125 * ty;
  const label = CONNECTION_TYPE_LABELS[edge.connectionType];
  const labelWidth = approxTextWidth(label, 10) + 12;
  return (
    `<g>` +
    `<path d="M ${sx} ${sy} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${tx} ${ty}" ` +
    `fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="${dash}" ` +
    `marker-end="url(#arrow-${edge.connectionType})"/>` +
    `<rect x="${mx - labelWidth / 2}" y="${my - 9}" width="${labelWidth}" height="18" rx="4" ` +
    `fill="#ffffff" fill-opacity="0.92"/>` +
    `<text x="${mx}" y="${my + 4}" font-size="10" fill="${color}" ` +
    `font-family='-apple-system, sans-serif' text-anchor="middle">` +
    escapeXml(label) +
    `</text>` +
    `</g>`
  );
}

function svgArrowDefs(): string {
  // One marker per connection type so arrowheads share their edge's colour.
  const types: ConnectionType[] = [
    "causes",
    "influences",
    "supports",
    "contradicts",
    "context",
    "related_to",
  ];
  return (
    `<defs>` +
    types
      .map((t) => {
        const color = CONNECTION_COLORS[t];
        return (
          `<marker id="arrow-${t}" markerWidth="10" markerHeight="10" refX="9" refY="5" ` +
          `orient="auto" markerUnits="strokeWidth">` +
          `<path d="M 0 0 L 10 5 L 0 10 z" fill="${color}"/>` +
          `</marker>`
        );
      })
      .join("") +
    `</defs>`
  );
}

// ─── Top-level renderer ───────────────────────────────────────────────────────

interface RenderOptions {
  /** Override the viewport rather than computing it from input bounds. */
  viewport?: BBox;
  /** Maximum output width in pixels. Aspect ratio is preserved. */
  maxWidth?: number;
}

/**
 * Build an SVG string for the given input, then rasterise to PNG and return
 * a `data:image/png;base64,...` URL. Returns null when the input has nothing
 * to render (no nodes and no frames).
 */
export function renderCanvasToPng(input: CanvasRenderInput, opts: RenderOptions = {}): string | null {
  const bbox = opts.viewport ?? computeBBox(input);
  if (!bbox) return null;

  const minX = bbox.minX - PADDING;
  const minY = bbox.minY - PADDING - 28; // extra top padding for frame labels
  const flowW = bbox.maxX - bbox.minX + PADDING * 2;
  const flowH = bbox.maxY - bbox.minY + PADDING * 2;

  // Index nodes by id so edge rendering can look up source/target.
  const nodeById = new Map(input.nodes.map((n) => [n.id, n]));

  // Frame label-only edges (those whose source or target isn't in the
  // visible node set) are skipped to avoid floating arrows.
  const visibleEdges = input.edges.filter(
    (e) => nodeById.has(e.sourceNodeId) && nodeById.has(e.targetNodeId)
  );

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${flowW} ${flowH}">` +
    svgArrowDefs() +
    // Background so PNGs aren't transparent (better for Word/PDF embeds).
    `<rect x="${minX}" y="${minY}" width="${flowW}" height="${flowH}" fill="#fafafa"/>` +
    input.frames.map(svgFrame).join("") +
    visibleEdges
      .map((e) => svgEdge(e, nodeById.get(e.sourceNodeId)!, nodeById.get(e.targetNodeId)!))
      .join("") +
    input.nodes.map(svgNode).join("") +
    `</svg>`;

  // Resvg's `fitTo` ensures the rasteriser scales to a sensible pixel size
  // regardless of the underlying flow-coord dimensions.
  const maxW = opts.maxWidth ?? 1400;
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: maxW },
    background: "#fafafa",
  });
  const png = resvg.render().asPng();
  return `data:image/png;base64,${png.toString("base64")}`;
}

/**
 * Render the full canvas plus a cropped PNG for each frame. Returns the
 * payload shape that `consultation_output_artifacts.canvas_image` expects.
 *
 * `null` when there is nothing to render (caller should leave canvas_image
 * unset on the report row).
 */
export function renderCanvasImagePayload(
  input: CanvasRenderInput
): { full: string; frames: Record<string, string>; capturedAt: string } | null {
  if (input.nodes.length === 0 && input.frames.length === 0) return null;

  const full = renderCanvasToPng(input);
  if (!full) return null;

  const frames: Record<string, string> = {};
  for (const frame of input.frames) {
    // Per-frame render uses the same node/edge sets but a viewport clipped
    // to the frame's bbox. Edges that exit the frame still render fully —
    // crossing arrows are part of the spatial story.
    const cropped = renderCanvasToPng(input, {
      viewport: {
        minX: frame.x,
        minY: frame.y,
        maxX: frame.x + frame.width,
        maxY: frame.y + frame.height,
      },
      maxWidth: 1000,
    });
    if (cropped) frames[frame.id] = cropped;
  }

  return {
    full,
    frames,
    capturedAt: new Date().toISOString(),
  };
}
