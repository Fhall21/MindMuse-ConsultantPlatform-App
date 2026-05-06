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
 * Coordinate conversion:
 * Frame bounds are stored in canvas flow coordinates. To crop the captured
 * bitmap per frame, we need to translate flow coords → DOM pixels relative
 * to the captured container. ReactFlow's current viewport transform
 * (`getViewport()`) provides the offset and zoom factor.
 */
import html2canvas from "html2canvas";
import type { CanvasFrame } from "@/types/canvas";

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
 * Failure handling: returns `null` if the canvas DOM isn't available or
 * html2canvas throws. Callers should treat this as best-effort and fall
 * back to live-render or list views.
 */
export async function captureCanvasImages(
  frames: CanvasFrame[]
): Promise<CapturedCanvasImages | null> {
  const container = findCanvasContainer();
  if (!container) return null;

  await settleFrame();

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

  const fullCanvas = await canvasToBlob(snapshot);

  const containerRect = container.getBoundingClientRect();
  const viewport = readViewportFromDom();
  const scale = window.devicePixelRatio || 1;

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
}): Promise<void> {
  const captured = await captureCanvasImages(params.frames);
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
