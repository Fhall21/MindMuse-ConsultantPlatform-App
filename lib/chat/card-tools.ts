import { INTAKE_CARD_TOOL_NAMES } from "./tools/intake";
import { parseToolMessageContent } from "./ui-messages";

/** Tools whose results render inline cards — never duplicate in assistant prose. */
export const CHAT_CARD_TOOL_NAMES = new Set<string>([
  ...INTAKE_CARD_TOOL_NAMES,
  "extract_themes",
  "identify_quotes",
  "generate_clarification",
]);

export function isChatCardToolName(toolName: string): boolean {
  return CHAT_CARD_TOOL_NAMES.has(toolName);
}

export function messageContentIsCardTool(content: string): boolean {
  const meta = parseToolMessageContent(content);
  return meta ? isChatCardToolName(meta.toolName) : false;
}

export async function sessionTurnIncludesCardTool(
  messages: Array<{ role: string; content: string }>,
  lookback = 12
): Promise<boolean> {
  const recent = messages.slice(-lookback);
  return recent.some(
    (message) => message.role === "tool" && messageContentIsCardTool(message.content)
  );
}
