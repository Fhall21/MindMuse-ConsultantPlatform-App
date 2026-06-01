import { z } from "zod";

export const identifyQuotesSchema = z.object({
  meeting_id: z.string().uuid(),
  theme_ids: z.array(z.string().uuid()).min(1),
});

export const quoteReviewItemSchema = z.object({
  id: z.string().uuid(),
  text: z.string(),
  speaker: z.string().optional(),
  theme_id: z.string().uuid(),
  theme_label: z.string(),
  span_start: z.number().int().nonnegative(),
  span_end: z.number().int().positive(),
});

export type QuoteReviewItem = z.infer<typeof quoteReviewItemSchema>;

export type QuoteDecision = "accepted" | "dismissed";

export const quoteDecisionSchema = z.enum(["accepted", "dismissed"]);

export interface QuoteReviewOutput {
  meeting_id: string;
  quotes: QuoteReviewItem[];
  decisions: Record<string, QuoteDecision>;
  db_quote_ids: Record<string, string>;
}

export interface IdentifiedQuoteDraft {
  text: string;
  speaker?: string | null;
  theme_id: string;
  span_start?: number | null;
  span_end?: number | null;
}

export function normalizeIdentifiedQuotes(raw: unknown): IdentifiedQuoteDraft[] {
  const payload =
    raw && typeof raw === "object" && "quotes" in raw
      ? (raw as { quotes?: unknown }).quotes
      : raw;

  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const record = item as Record<string, unknown>;
      const text = typeof record.text === "string" ? record.text.trim() : "";
      const themeId =
        typeof record.theme_id === "string" ? record.theme_id.trim() : "";
      if (!text || !themeId) {
        return null;
      }

      return {
        text,
        speaker:
          typeof record.speaker === "string" ? record.speaker.trim() : null,
        theme_id: themeId,
        span_start:
          typeof record.span_start === "number" ? record.span_start : null,
        span_end: typeof record.span_end === "number" ? record.span_end : null,
      };
    })
    .filter((item): item is IdentifiedQuoteDraft => item !== null);
}

export function buildQuoteReviewOutput(params: {
  meetingId: string;
  quotes: QuoteReviewItem[];
  decisions?: Record<string, QuoteDecision>;
  dbQuoteIds?: Record<string, string>;
}): QuoteReviewOutput {
  return {
    meeting_id: params.meetingId,
    quotes: params.quotes,
    decisions: params.decisions ?? {},
    db_quote_ids: params.dbQuoteIds ?? {},
  };
}

export function readQuoteReviewOutput(output: unknown): QuoteReviewOutput | null {
  if (!output || typeof output !== "object") {
    return null;
  }

  const record = output as Record<string, unknown>;
  if (typeof record.meeting_id !== "string") {
    return null;
  }

  const quotesRaw = record.quotes;
  if (!Array.isArray(quotesRaw)) {
    return null;
  }

  const quotes: QuoteReviewItem[] = [];
  for (const item of quotesRaw) {
    const parsed = quoteReviewItemSchema.safeParse(item);
    if (parsed.success) {
      quotes.push(parsed.data);
    }
  }

  if (quotes.length === 0) {
    return null;
  }

  const decisionsRaw = record.decisions ?? record.quote_decisions;
  const decisions: Record<string, QuoteDecision> = {};
  if (decisionsRaw && typeof decisionsRaw === "object") {
    for (const [key, value] of Object.entries(decisionsRaw)) {
      if (value === "accepted" || value === "dismissed") {
        decisions[key] = value;
      }
    }
  }

  const dbQuoteIdsRaw = record.db_quote_ids;
  const db_quote_ids: Record<string, string> = {};
  if (dbQuoteIdsRaw && typeof dbQuoteIdsRaw === "object") {
    for (const [key, value] of Object.entries(dbQuoteIdsRaw)) {
      if (typeof value === "string") {
        db_quote_ids[key] = value;
      }
    }
  }

  return {
    meeting_id: record.meeting_id,
    quotes,
    decisions,
    db_quote_ids,
  };
}

export function formatTranscriptPosition(spanStart: number, spanEnd: number): string {
  return `chars ${spanStart.toLocaleString()}–${spanEnd.toLocaleString()}`;
}
