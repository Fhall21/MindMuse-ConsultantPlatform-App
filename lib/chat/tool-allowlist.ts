/** FastAPI endpoints the chat agent may call. Blocks SSRF from crafted tool output. */
export const CHAT_TOOL_FASTAPI_ALLOWLIST = new Set([
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
]);

export function assertAllowedFastApiPath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (!CHAT_TOOL_FASTAPI_ALLOWLIST.has(normalized)) {
    throw new Error(`Tool dispatch blocked: ${normalized} is not allowlisted`);
  }
  return normalized;
}

/** Maps agent tool names to FastAPI paths (Task 04+ fills in full registry). */
export const CHAT_TOOL_ENDPOINTS: Record<string, string> = {
  intake_text_transcript: "/transcribe/text",
  intake_audio_transcript: "/transcribe/audio",
  intake_notes: "/ocr/extract",
  extract_themes: "/themes/extract",
  generate_clarification: "/clarification/questions",
  identify_quotes: "/quotes/identify",
  group_themes: "/rounds/suggest-theme-groups",
  preview_canvas: "/canvas/layout",
  generate_research_questions: "/research/generate",
  draft_evidence_email: "/draft/email",
  generate_report: "/rounds/generate-report",
};
