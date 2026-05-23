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
