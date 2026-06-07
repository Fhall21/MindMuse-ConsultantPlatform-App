"""Paths that require a valid chat service token when called directly.

Mirrors Next.js lib/chat/tool-allowlist.ts. Other FastAPI routes stay open for
existing Next.js proxy handlers that do not send Bearer tokens.
"""

CHAT_PROTECTED_PATHS: frozenset[str] = frozenset(
    {
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
        "/grid/generate",
        "/grid/column-suggestions",
        "/rounds/generate-report",
        "/analysis/start",
    }
)
