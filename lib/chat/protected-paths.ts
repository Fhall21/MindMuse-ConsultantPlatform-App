/** FastAPI paths that require Authorization: Bearer (chat service token). Mirrors services/ai/core/chat_protected_paths.py */
export const CHAT_PROTECTED_FASTAPI_PATHS = new Set([
  "/transcribe/text",
  "/transcribe/audio",
  "/ocr/extract",
  "/themes/extract",
  "/clarification/questions",
  "/quotes/identify",
  "/rounds/suggest-theme-groups",
  "/canvas/layout",
  "/research/generate",
  "/draft/email",
  "/rounds/generate-report",
  "/analysis/start",
]);

export function isChatProtectedFastApiPath(path: string): boolean {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return CHAT_PROTECTED_FASTAPI_PATHS.has(normalized);
}
