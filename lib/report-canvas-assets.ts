/**
 * Bridge between the browser-side canvas capture and the report artifact row.
 *
 * `captureCanvasImages()` returns Blobs. Reports persist data URLs (in the
 * `canvas_image` jsonb column on `consultation_output_artifacts`) so every
 * renderer — live React view, markdown serializer, react-pdf, docx ImageRun —
 * can embed the same payload without a storage round-trip.
 *
 * Data URLs are larger than HTTP refs but trade-offs are deliberate for v1:
 *   - zero new infra (no Storage bucket, no signed URL plumbing)
 *   - atomic write with the rest of the report row
 *   - works identically server-side and client-side
 *
 * If payloads ever exceed ~3 MB we should move `full` to Storage and keep
 * `frames` inline (frames are typically a fraction of full).
 */
import type { CapturedCanvasImages } from "@/lib/canvas-snapshot";
import type { CapturedCanvasImagePayload } from "@/types/canvas";

/** Convert a single Blob to a `data:image/png;base64,...` string. */
export async function blobToDataUrl(blob: Blob): Promise<string> {
  // FileReader is the universally-supported path that works in both
  // browser DOM and any DOM-emulating test env (jsdom/happy-dom).
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const r = reader.result;
      if (typeof r === "string") resolve(r);
      else reject(new Error("FileReader returned non-string result"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("FileReader failed"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Convert `captureCanvasImages()` output into the persistence-ready payload.
 * Skips frames whose blob is missing rather than emitting an undefined entry.
 */
export async function buildCanvasImagePayload(
  captured: CapturedCanvasImages
): Promise<CapturedCanvasImagePayload> {
  const full = await blobToDataUrl(captured.fullCanvas);
  const frames: Record<string, string> = {};
  for (const [frameId, blob] of Object.entries(captured.perFrame)) {
    frames[frameId] = await blobToDataUrl(blob);
  }
  return {
    full,
    frames,
    capturedAt: new Date().toISOString(),
  };
}

const DATA_URL_PATTERN = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/;

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface ImageFitOptions {
  maxWidth: number;
  maxHeight?: number;
}

/**
 * Decode a data URL into a Buffer for server-side embedders (docx ImageRun,
 * react-pdf Image, etc.). Throws on malformed input.
 */
export function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; mime: string } {
  const match = dataUrl.match(DATA_URL_PATTERN);
  if (!match) throw new Error("dataUrlToBuffer: not a base64 image data URL");
  const mime = match[1]!;
  const b64 = match[2]!;
  return { buffer: Buffer.from(b64, "base64"), mime };
}

function parseSvgDimension(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.trim().match(/^([0-9]+(?:\.[0-9]+)?)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function svgDimensions(svg: string): ImageDimensions | null {
  const viewBoxMatch = svg.match(/\bviewBox=["']([^"']+)["']/i);
  if (viewBoxMatch) {
    const values = viewBoxMatch[1]!
      .trim()
      .split(/[\s,]+/)
      .map((value) => Number(value));
    const width = values[2];
    const height = values[3];
    if (
      Number.isFinite(width) &&
      Number.isFinite(height) &&
      width > 0 &&
      height > 0
    ) {
      return { width, height };
    }
  }

  const width = parseSvgDimension(svg.match(/\bwidth=["']([^"']+)["']/i)?.[1]);
  const height = parseSvgDimension(svg.match(/\bheight=["']([^"']+)["']/i)?.[1]);
  return width && height ? { width, height } : null;
}

function pngDimensions(buffer: Buffer): ImageDimensions | null {
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(pngSignature)) {
    return null;
  }
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return width > 0 && height > 0 ? { width, height } : null;
}

export function getDataUrlImageDimensions(dataUrl: string): ImageDimensions | null {
  try {
    const { buffer, mime } = dataUrlToBuffer(dataUrl);
    if (mime === "image/svg+xml") return svgDimensions(buffer.toString("utf-8"));
    if (mime === "image/png") return pngDimensions(buffer);
    return null;
  } catch {
    return null;
  }
}

export function fitImageDimensions(
  dimensions: ImageDimensions,
  options: ImageFitOptions
): ImageDimensions {
  const width = Number.isFinite(dimensions.width) ? dimensions.width : 0;
  const height = Number.isFinite(dimensions.height) ? dimensions.height : 0;
  const maxWidth = Number.isFinite(options.maxWidth) ? options.maxWidth : 0;
  const maxHeight = options.maxHeight;

  if (width <= 0 || height <= 0 || maxWidth <= 0) {
    return { width: maxWidth, height: 0 };
  }

  const scaleByWidth = maxWidth / width;
  const scaleByHeight =
    maxHeight && maxHeight > 0 ? maxHeight / height : scaleByWidth;
  const scale = Math.min(scaleByWidth, scaleByHeight);

  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

export function fitDataUrlImage(
  dataUrl: string,
  options: ImageFitOptions,
  fallbackRatio = 1.6
): ImageDimensions {
  const dimensions = getDataUrlImageDimensions(dataUrl);
  if (dimensions) return fitImageDimensions(dimensions, options);

  const width = options.maxWidth;
  const height = Math.round(width / fallbackRatio);
  return fitImageDimensions({ width, height }, options);
}
