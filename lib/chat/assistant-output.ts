const TOOL_CALL_LEAK_PATTERNS = [
  /```[\s\S]*?\bto=functions\.[\w.-]+[\s\S]*?```/gi,
  /(?:^|\n)\s*[\w.-]+\s+to=functions\.[\w.-]+[\s\S]*?(?=\n{2,}|$)/gi,
  /<\|(?:assistant\s+to=functions|tool_call)[\s\S]*?\|>/gi,
];

export const ASSISTANT_OUTPUT_FALLBACK =
  "I couldn't complete that cleanly. Please try again.";

export function stripLeakedToolSyntax(text: string): string {
  return TOOL_CALL_LEAK_PATTERNS.reduce(
    (value, pattern) => value.replace(pattern, ""),
    text
  )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function sanitizeAssistantOutput(text: string): string {
  const sanitized = stripLeakedToolSyntax(text);
  return sanitized || ASSISTANT_OUTPUT_FALLBACK;
}
