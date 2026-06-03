import type { MeetingPendingAction } from "./meeting-pending-action";

/**
 * AI-suggested quote extraction (identify_quotes / QuoteCard).
 * Default for any other quote work is manual highlight (show_quotes / QuoteReviewPanel).
 */
export function wantsAutomaticQuoteExtraction(userMessage: string): boolean {
  const lower = userMessage.toLowerCase();
  return (
    /\b(identify quotes?|ai[- ]?suggest(?:ed)? quotes?|automatic(?:ally)? (?:extract|find|pull) quotes?|auto[- ]?extract quotes?|suggest(?:ed)? quotes? for (?:me|review)|find key quotes? (?:for me|automatically)|pull key quotes? automatically)\b/.test(
      lower
    ) ||
    /\b(extract|find|pull|get)\b[^.]{0,40}\b(key )?quotes?\b[^.]{0,40}\b(automatically|with ai|using ai|for me to review)\b/.test(
      lower
    )
  );
}

export function inferQuotePendingAction(userMessage: string): MeetingPendingAction {
  return wantsAutomaticQuoteExtraction(userMessage) ? "identify_quotes" : "show_quotes";
}

export function messageMentionsQuotes(userMessage: string): boolean {
  return /\bquotes?\b/i.test(userMessage);
}
