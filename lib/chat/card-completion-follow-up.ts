import {
  QUOTE_REVIEW_DONE_FOLLOW_UP,
  THEME_REVIEW_DONE_FOLLOW_UP,
} from "./onboarding-copy";
import { insertChatMessage } from "./persist";
import { readQuoteReviewOutput } from "./tools/quotes";
import { readThemeReviewOutput } from "./tools/themes";

export function resolveCardCompletionFollowUp(
  toolName: string,
  output: unknown
): string | null {
  switch (toolName) {
    case "extract_themes":
      return readThemeReviewOutput(output) ? THEME_REVIEW_DONE_FOLLOW_UP : null;
    case "identify_quotes":
      return readQuoteReviewOutput(output) ? QUOTE_REVIEW_DONE_FOLLOW_UP : null;
    default:
      return null;
  }
}

export async function maybeInsertCardCompletionFollowUp(params: {
  sessionId: string;
  toolName: string;
  previousStatus: string;
  nextStatus: string;
  output: unknown;
}): Promise<void> {
  if (params.previousStatus === "success" || params.nextStatus !== "success") {
    return;
  }

  const followUp = resolveCardCompletionFollowUp(params.toolName, params.output);
  if (!followUp) {
    return;
  }

  await insertChatMessage({
    sessionId: params.sessionId,
    role: "assistant",
    content: followUp,
  });
}
