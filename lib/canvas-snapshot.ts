/**
 * Canvas snapshot helpers (sprint 16 task 03.5).
 *
 * Capture the live ReactFlow canvas DOM as a PNG, with optional per-frame
 * crops. Used by:
 *   - The "Export view" toolbar button → triggers downloads.
 *   - The report generation pipeline → uploads and stores image URLs in the
 *     v2 NetworkSnapshot for layout-preserving report rendering.
 *
 * Why html2canvas + foreignObjectRendering:false?
 * ReactFlow's internal renderer can fall back to WebGL on some browsers,
 * which leaves html2canvas with a blank capture. Forcing the non-WebGL
 * rasteriser path avoids that.
 *
 * Why composite edges manually?
 * html2canvas with foreignObjectRendering:false skips ReactFlow's SVG edge
 * layer (.react-flow__edges). Rather than switching capture libraries, we
 * read the live handle DOM positions after capture-settle and draw edges
 * onto the bitmap using Canvas 2D API. This keeps connection lines, colors,
 * dash patterns, arrowheads, and type labels in the exported image.
 *
 * Coordinate conversion:
 * Frame bounds are stored in canvas flow coordinates. To crop the captured
 * bitmap per frame, we need to translate flow coords → DOM pixels relative
 * to the captured container. ReactFlow's current viewport transform
 * (`getViewport()`) provides the offset and zoom factor.
 */
// html2canvas-pro is a fork of html2canvas with modern CSS color function
// support (oklch, lab, color-mix). Required because Tailwind v4 emits oklch
// colors which the original html2canvas can't parse.
import html2canvas from "html2canvas-pro";
import type { CanvasEdge, CanvasFrame } from "@/types/canvas";

// ─── Edge overlay constants (mirror canvas-graph.tsx) ────────────────────────

const CONNECTION_COLORS: Record<string, string> = {
  causes: "#ef4444",
  influences: "#f97316",
  supports: "#22c55e",
  contradicts: "#dc2626",
  related_to: "#6b7280",
};

const CONNECTION_TYPE_LABELS: Record<string, string> = {
  causes: "Causes",
  influences: "Influences",
  supports: "Supports",
  contradicts: "Contradicts",
  related_to: "Related to",
};

// ─── Handle point reading ─────────────────────────────────────────────────────

interface HandlePoint {
  x: number;
  y: number;
}

/**
 * Read the center screen-coords (relative to the container's top-left) for
 * every source and target handle in the live ReactFlow DOM.
 *
 * ReactFlow marks handle elements with `data-handletype="source"` /
 * `data-handletype="target"` and scopes them inside `.react-flow__node[data-id]`
 * elements. We read `getBoundingClientRect()` on each handle so custom
 * positioning (e.g. `!top-12` on theme-card handles) is accounted for exactly.
 *
 * Frame nodes (id prefix `frame:`) are skipped — they carry no edges.
 */
function readHandlePoints(container: HTMLElement): {
  sources: Map<string, HandlePoint>;
  targets: Map<string, HandlePoint>;
} {
  const containerRect = container.getBoundingClientRect();
  const sources = new Map<string, HandlePoint>();
  const targets = new Map<string, HandlePoint>();

  const nodeEls = container.querySelectorAll<HTMLElement>(".react-flow__node[data-id]");
  for (const nodeEl of nodeEls) {
    const nodeId = nodeEl.getAttribute("data-id");
    if (!nodeId || nodeId.startsWith("frame:")) continue;

    const sourceHandle = nodeEl.querySelector<HTMLElement>('[data-handletype="source"]');
    const targetHandle = nodeEl.querySelector<HTMLElement>('[data-handletype="target"]');

    if (sourceHandle) {
      const r = sourceHandle.getBoundingClientRect();
      sources.set(nodeId, {
        x: r.left - containerRect.left + r.width / 2,
        y: r.top - containerRect.top + r.height / 2,
      });
    }
    if (targetHandle) {
      const r = targetHandle.getBoundingClientRect();
      targets.set(nodeId, {
        x: r.left - containerRect.left + r.width / 2,
        y: r.top - containerRect.top + r.height / 2,
      });
    }
  }
  return { sources, targets };
}

// ─── Edge compositing ─────────────────────────────────────────────────────────

/**
 * Draw edge bezier curves, arrowheads, and type labels onto `bitmap`.
 *
 * Called after html2canvas capture so edges appear in both the full-canvas
 * and all per-frame crops (which are sliced from the same bitmap).
 *
 * Bezier approximation:
 *   ReactFlow uses a smooth-step bezier. We approximate it with a cubic
 *   bezier whose control points offset horizontally by half the x-distance,
 *   which matches the visual for typical LR / non-overlapping node layouts.
 *
 * `scale` is `window.devicePixelRatio` — html2canvas captures at that factor,
 * so all bitmap coordinates must be multiplied accordingly.
 */
function overlayEdges(
  bitmap: HTMLCanvasElement,
  edges: CanvasEdge[],
  sources: Map<string, HandlePoint>,
  targets: Map<string, HandlePoint>,
  scale: number
): void {
  const ctx = bitmap.getContext("2d");
  if (!ctx) return;

  for (const edge of edges) {
    const src = sources.get(edge.source_node_id);
    const tgt = targets.get(edge.target_node_id);
    if (!src || !tgt) continue;

    const sx = src.x * scale;
    const sy = src.y * scale;
    const tx = tgt.x * scale;
    const ty = tgt.y * scale;

    const color = CONNECTION_COLORS[edge.connection_type] ?? "#6b7280";
    const strokeWidth = 2.5 * scale;

    // Cubic bezier — control points offset by half the horizontal span.
    const hx = Math.abs(tx - sx) * 0.5;
    const cp1x = sx + hx;
    const cp1y = sy;
    const cp2x = tx - hx;
    const cp2y = ty;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = strokeWidth;
    ctx.setLineDash(edge.connection_type === "contradicts" ? [6 * scale, 4 * scale] : []);

    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, tx, ty);
    ctx.stroke();

    // ── Arrowhead at target ───────────────────────────────────────────────
    const arrowSize = 8 * scale;
    // Angle from last control point to target gives the arriving direction.
    const angle = Math.atan2(ty - cp2y, tx - cp2x);
    ctx.setLineDash([]);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(
      tx - arrowSize * Math.cos(angle - Math.PI / 6),
      ty - arrowSize * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      tx - arrowSize * Math.cos(angle + Math.PI / 6),
      ty - arrowSize * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();

    // ── Edge type label at bezier midpoint (De Casteljau t=0.5) ──────────
    const mx = 0.125 * sx + 0.375 * cp1x + 0.375 * cp2x + 0.125 * tx;
    const my = 0.125 * sy + 0.375 * cp1y + 0.375 * cp2y + 0.125 * ty;
    const label = CONNECTION_TYPE_LABELS[edge.connection_type] ?? edge.connection_type;
    const fontSize = Math.round(11 * scale);

    ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    const metrics = ctx.measureText(label);
    const padX = 4 * scale;
    const padY = 3 * scale;
    const bgW = metrics.width + padX * 2;
    const bgH = fontSize + padY * 2;

    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.beginPath();
    const r = 3 * scale;
    ctx.roundRect(mx - bgW / 2, my - bgH / 2, bgW, bgH, r);
    ctx.fill();

    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, mx, my);

    ctx.restore();
  }
}

// ─── Public types ─────────────────────────────────────────────────────────────

export interface CapturedCanvasImages {
  /** Full-canvas image as a PNG Blob. */
  fullCanvas: Blob;
  /** Per-frame cropped PNG Blob, keyed by frame id. */
  perFrame: Record<string, Blob>;
}

/**
 * Find the live ReactFlow viewport DOM element. ReactFlow renders the canvas
 * inside `.react-flow__viewport` which has the pan/zoom transform applied,
 * but for pixel capture we want the parent `.react-flow` (the visible area).
 */
function findCanvasContainer(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".react-flow");
}

/** Sleep for `ms` so React Flow can flush its last render before capture. */
function settleFrame(ms = 100) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Convert a ReactFlow viewport transform (translateX, translateY, scale) to
 * the screen-space rect of a frame's bounding box.
 */
function frameToScreenRect(
  frame: { x: number; y: number; width: number; height: number },
  viewport: { x: number; y: number; zoom: number }
) {
  return {
    x: frame.x * viewport.zoom + viewport.x,
    y: frame.y * viewport.zoom + viewport.y,
    width: frame.width * viewport.zoom,
    height: frame.height * viewport.zoom,
  };
}

/**
 * Read the current ReactFlow viewport transform from the DOM. Used outside
 * the React tree (e.g. snapshot pipelines that don't have a `useReactFlow`
 * hook handy). Falls back to identity transform if the viewport node is
 * missing.
 */
function readViewportFromDom(): { x: number; y: number; zoom: number } {
  const node = document.querySelector<HTMLElement>(".react-flow__viewport");
  if (!node) return { x: 0, y: 0, zoom: 1 };
  const transform = window.getComputedStyle(node).transform;
  if (!transform || transform === "none") return { x: 0, y: 0, zoom: 1 };
  // matrix(a, b, c, d, tx, ty) — for our transforms a === d === scale.
  const m = transform.match(/matrix\(([^)]+)\)/);
  if (!m) return { x: 0, y: 0, zoom: 1 };
  const parts = m[1]!.split(",").map((v) => Number.parseFloat(v.trim()));
  if (parts.length < 6) return { x: 0, y: 0, zoom: 1 };
  return { zoom: parts[0]!, x: parts[4]!, y: parts[5]! };
}

/**
 * Crop a region out of a source HTMLCanvasElement and return a PNG Blob.
 * Coordinates are in CSS pixels and may be fractional or negative — we
 * clamp them to the source bounds before drawing.
 */
async function cropToBlob(
  source: HTMLCanvasElement,
  rect: { x: number; y: number; width: number; height: number }
): Promise<Blob> {
  const sx = Math.max(0, Math.floor(rect.x));
  const sy = Math.max(0, Math.floor(rect.y));
  const sw = Math.max(1, Math.min(Math.ceil(rect.width), source.width - sx));
  const sh = Math.max(1, Math.min(Math.ceil(rect.height), source.height - sy));
  const target = document.createElement("canvas");
  target.width = sw;
  target.height = sh;
  const ctx = target.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable for canvas crop");
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
  return new Promise<Blob>((resolve, reject) => {
    target.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob returned null"))),
      "image/png"
    );
  });
}

/** Convert a full HTMLCanvasElement to a PNG Blob. */
function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob returned null"))),
      "image/png"
    );
  });
}

/**
 * Capture the canvas + each frame as PNG blobs.
 *
 * Edges are composited onto the bitmap after html2canvas capture using Canvas
 * 2D API (html2canvas skips the SVG edge layer when foreignObjectRendering is
 * false). Handle positions are read directly from the live DOM so custom
 * vertical offsets (e.g. `!top-12` on theme-card handles) are captured
 * exactly. Per-frame crops are taken from the composited bitmap, so edges
 * that cross frame boundaries appear in full in every output.
 *
 * Failure handling: returns `null` if the canvas DOM isn't available or
 * html2canvas throws. Callers should treat this as best-effort and fall
 * back to live-render or list views.
 */
export async function captureCanvasImages(
  frames: CanvasFrame[],
  edges: CanvasEdge[]
): Promise<CapturedCanvasImages | null> {
  const container = findCanvasContainer();
  if (!container) return null;

  await settleFrame();

  // Read handle positions AFTER settle so they match the frame we're about to
  // capture. Must happen before html2canvas to avoid layout shifts during capture.
  const { sources, targets } = readHandlePoints(container);

  let snapshot: HTMLCanvasElement;
  try {
    snapshot = await html2canvas(container, {
      // Avoid WebGL blank-output issue documented for html2canvas.
      foreignObjectRendering: false,
      backgroundColor: null,
      logging: false,
      // Use device pixel ratio for crisp output.
      scale: window.devicePixelRatio || 1,
    });
  } catch (error) {
    console.error("[canvas-snapshot] html2canvas failed", error);
    return null;
  }

  const scale = window.devicePixelRatio || 1;

  // Composite edges onto the bitmap. This mutates `snapshot` in-place before
  // any blob extraction so both full-canvas and per-frame crops include edges.
  if (edges.length > 0) {
    overlayEdges(snapshot, edges, sources, targets, scale);
  }

  const fullCanvas = await canvasToBlob(snapshot);

  const containerRect = container.getBoundingClientRect();
  const viewport = readViewportFromDom();

  const perFrame: Record<string, Blob> = {};
  for (const frame of frames) {
    const screenRect = frameToScreenRect(frame, viewport);
    // Clamp to the visible container — frames outside the viewport produce
    // empty crops. Multiply by devicePixelRatio because html2canvas captures
    // at that scale.
    const rect = {
      x: screenRect.x * scale,
      y: screenRect.y * scale,
      width: screenRect.width * scale,
      height: screenRect.height * scale,
    };
    // Skip frames that are entirely outside the captured container.
    if (
      screenRect.x + screenRect.width < 0 ||
      screenRect.y + screenRect.height < 0 ||
      screenRect.x > containerRect.width ||
      screenRect.y > containerRect.height
    ) {
      continue;
    }
    try {
      perFrame[frame.id] = await cropToBlob(snapshot, rect);
    } catch (error) {
      console.warn("[canvas-snapshot] failed to crop frame", frame.id, error);
    }
  }

  return { fullCanvas, perFrame };
}

/** Trigger a browser download of `blob` with the given filename. */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Free the object URL on the next tick so the download has time to start.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeFileSlug(value: string) {
  return value.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "") || "frame";
}

/**
 * Capture and download the full canvas + one image per frame as separate PNG
 * files. Sequential `<a>` downloads — no zip dependency.
 *
 * Naming:
 *   canvas-{roundId}.png
 *   frame-{slug(name)}.png  (one per frame)
 */
export async function downloadCanvasImages(params: {
  roundId: string;
  frames: CanvasFrame[];
  edges: CanvasEdge[];
}): Promise<void> {
  const captured = await captureCanvasImages(params.frames, params.edges);
  if (!captured) {
    throw new Error("Canvas capture unavailable");
  }
  downloadBlob(captured.fullCanvas, `canvas-${params.roundId}.png`);
  for (const frame of params.frames) {
    const blob = captured.perFrame[frame.id];
    if (!blob) continue;
    downloadBlob(blob, `frame-${safeFileSlug(frame.name)}.png`);
  }
}
