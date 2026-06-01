import { TRANSCRIPT_ACCEPTED_ATTR } from "@/lib/transcript-file-parser";

export const CAPTURE_AUDIO_MIME_TYPES = [
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
  "audio/flac",
  "audio/x-m4a",
] as const;

export const CAPTURE_NOTES_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

export const CAPTURE_NOTES_HEIC_TYPES = ["image/heic", "image/heif"] as const;

export const CAPTURE_NOTES_ACCEPT_ATTR =
  ".jpg,.jpeg,.png,.gif,.webp,.heic,.heif,image/*";

export const CAPTURE_TRANSCRIPT_ACCEPT_ATTR = `${TRANSCRIPT_ACCEPTED_ATTR},${CAPTURE_AUDIO_MIME_TYPES.join(",")}`;
