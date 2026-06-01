import { CAPTURE_NOTES_HEIC_TYPES, CAPTURE_NOTES_IMAGE_TYPES } from "./constants";

async function loadHeic2Any() {
  if (typeof window === "undefined") {
    throw new Error("HEIC conversion is only available in the browser.");
  }
  const heicModule = await import("heic2any");
  return heicModule.default;
}

/** Prepare an image blob for OCR — converts HEIC/HEIF to JPEG when needed. */
export async function prepareImageBlob(file: File): Promise<{ blob: Blob; name: string }> {
  const isHeic =
    CAPTURE_NOTES_HEIC_TYPES.includes(file.type as (typeof CAPTURE_NOTES_HEIC_TYPES)[number]) ||
    /\.(heic|heif)$/i.test(file.name);
  if (!isHeic) {
    return { blob: file, name: file.name };
  }

  const heic2any = await loadHeic2Any();
  const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
  const blob = Array.isArray(converted) ? converted[0] : converted;
  return { blob, name: file.name.replace(/\.(heic|heif)$/i, ".jpg") };
}

export function isNotesImageFile(file: File): boolean {
  return (
    CAPTURE_NOTES_IMAGE_TYPES.includes(file.type as (typeof CAPTURE_NOTES_IMAGE_TYPES)[number]) ||
    CAPTURE_NOTES_HEIC_TYPES.includes(file.type as (typeof CAPTURE_NOTES_HEIC_TYPES)[number]) ||
    /\.(heic|heif)$/i.test(file.name)
  );
}

/** Run OCR via the same authenticated API route used by meeting capture. */
export async function extractOcrTextFromFile(file: File): Promise<string> {
  const { blob, name } = await prepareImageBlob(file);
  const formData = new FormData();
  formData.append("image_file", blob, name);

  const response = await fetch("/api/ocr/extract", { method: "POST", body: formData });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { detail?: string };
    throw new Error(body.detail ?? `OCR request failed (${response.status})`);
  }

  const result = (await response.json()) as { extracted_text?: string };
  const text = result.extracted_text?.trim() ?? "";
  if (!text) {
    throw new Error(
      "No readable text was found in that photo. Retake the image or paste notes manually."
    );
  }

  return text;
}
