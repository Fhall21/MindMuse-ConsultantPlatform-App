import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { insights } from "@/db/schema";
import {
  approveQuote,
  createQuote,
} from "@/lib/actions/quotes";
import { requireOwnedMeeting, requireOwnedTheme } from "@/lib/data/ownership";
import { recordOnboardingMilestone } from "@/lib/chat/onboarding-state";
import { dispatchToolToFastApi } from "./tool-dispatch";
import { CHAT_TOOL_ENDPOINTS } from "./tool-allowlist";
import { loadMeetingTranscript } from "./themes-db";
import {
  dismissPriorPendingToolResults,
  getToolResultForSession,
  updateToolResult,
} from "./persist";
import {
  buildQuoteReviewOutput,
  normalizeIdentifiedQuotes,
  readQuoteReviewOutput,
  type IdentifiedQuoteDraft,
  type QuoteDecision,
  type QuoteReviewItem,
  type QuoteReviewOutput,
} from "./tools/quotes";

function resolveQuoteSpan(
  transcript: string,
  text: string,
  spanStart?: number | null,
  spanEnd?: number | null
): { spanStart: number; spanEnd: number } | null {
  if (
    typeof spanStart === "number" &&
    typeof spanEnd === "number" &&
    spanEnd > spanStart
  ) {
    const slice = transcript.slice(spanStart, spanEnd);
    if (slice === text) {
      return { spanStart, spanEnd };
    }
  }

  const index = transcript.indexOf(text);
  if (index >= 0) {
    return { spanStart: index, spanEnd: index + text.length };
  }

  return null;
}

async function loadInsightLabelsForMeeting(params: {
  userId: string;
  meetingId: string;
  themeIds: string[];
}): Promise<Map<string, string>> {
  const labels = new Map<string, string>();

  for (const themeId of params.themeIds) {
    const { theme } = await requireOwnedTheme(
      themeId,
      params.meetingId,
      params.userId
    );
    labels.set(theme.id, theme.label);
  }

  return labels;
}

function buildReviewItems(params: {
  meetingId: string;
  transcript: string;
  drafts: IdentifiedQuoteDraft[];
  labels: Map<string, string>;
  allowedThemeIds: Set<string>;
}): QuoteReviewItem[] {
  const items: QuoteReviewItem[] = [];

  for (const draft of params.drafts) {
    if (!params.allowedThemeIds.has(draft.theme_id)) {
      continue;
    }

    const span = resolveQuoteSpan(
      params.transcript,
      draft.text,
      draft.span_start,
      draft.span_end
    );
    if (!span) {
      continue;
    }

    const themeLabel = params.labels.get(draft.theme_id);
    if (!themeLabel) {
      continue;
    }

    items.push({
      id: randomUUID(),
      text: draft.text,
      speaker: draft.speaker ?? undefined,
      theme_id: draft.theme_id,
      theme_label: themeLabel,
      span_start: span.spanStart,
      span_end: span.spanEnd,
    });
  }

  return items;
}

export async function identifyAndPersistQuotes(params: {
  userId: string;
  sessionId: string;
  meetingId: string;
  themeIds: string[];
}): Promise<{ ok: true; output: QuoteReviewOutput } | { ok: false; error: string }> {
  await requireOwnedMeeting(params.meetingId, params.userId);

  const transcriptResult = await loadMeetingTranscript(params.userId, params.meetingId);
  if (!transcriptResult.ok) {
    return transcriptResult;
  }

  const uniqueThemeIds = [...new Set(params.themeIds)];
  let labels: Map<string, string>;
  try {
    labels = await loadInsightLabelsForMeeting({
      userId: params.userId,
      meetingId: params.meetingId,
      themeIds: uniqueThemeIds,
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Invalid theme selection",
    };
  }

  const result = await dispatchToolToFastApi({
    userId: params.userId,
    sessionId: params.sessionId,
    endpoint: CHAT_TOOL_ENDPOINTS.identify_quotes,
    body: {
      transcript: transcriptResult.transcript,
      themes: uniqueThemeIds.map((id) => ({
        id,
        label: labels.get(id) ?? "",
      })),
    },
  });

  if (!result.ok) {
    return result;
  }

  const drafts = normalizeIdentifiedQuotes(result.data);
  const quotes = buildReviewItems({
    meetingId: params.meetingId,
    transcript: transcriptResult.transcript,
    drafts,
    labels,
    allowedThemeIds: new Set(uniqueThemeIds),
  });

  if (quotes.length === 0) {
    return {
      ok: false,
      error: "No matching quotes were found in the transcript for those insights.",
    };
  }

  await dismissPriorPendingToolResults(params.sessionId, "identify_quotes");

  return {
    ok: true,
    output: buildQuoteReviewOutput({
      meetingId: params.meetingId,
      quotes,
    }),
  };
}

export function mergeQuoteDecision(
  output: QuoteReviewOutput,
  quoteId: string,
  decision: QuoteDecision
): QuoteReviewOutput {
  return {
    ...output,
    decisions: {
      ...output.decisions,
      [quoteId]: decision,
    },
  };
}

export function attachDbQuoteId(
  output: QuoteReviewOutput,
  cardQuoteId: string,
  dbQuoteId: string
): QuoteReviewOutput {
  return {
    ...output,
    db_quote_ids: {
      ...output.db_quote_ids,
      [cardQuoteId]: dbQuoteId,
    },
  };
}

export function hasAnyAcceptedQuoteDecision(
  decisions: Record<string, QuoteDecision>
): boolean {
  return Object.values(decisions).some((value) => value === "accepted");
}

export async function acceptQuoteForMeeting(params: {
  userId: string;
  sessionId?: string;
  meetingId: string;
  cardQuoteId: string;
  themeId: string;
  text: string;
  spanStart: number;
  spanEnd: number;
  speaker?: string | null;
  toolResultId?: string;
}): Promise<{ quoteId: string; hadPriorAccept: boolean }> {
  await requireOwnedTheme(params.themeId, params.meetingId, params.userId);

  let hadPriorAccept = false;
  if (params.toolResultId && params.sessionId) {
    const existing = await getToolResultForSession(
      params.toolResultId,
      params.sessionId
    );
    const reviewOutput = existing ? readQuoteReviewOutput(existing.output) : null;
    hadPriorAccept = reviewOutput
      ? hasAnyAcceptedQuoteDecision(reviewOutput.decisions)
      : false;
  }

  const created = await createQuote({
    meetingId: params.meetingId,
    spanStart: params.spanStart,
    spanEnd: params.spanEnd,
    exactText: params.text,
    speakerLabel: params.speaker ?? null,
    source: "ai",
  });

  const approved = await approveQuote({
    quoteId: created.id,
    primaryInsightId: params.themeId,
  });

  if (params.sessionId && !hadPriorAccept) {
    await recordOnboardingMilestone(params.userId, params.sessionId, "quotes");
  }

  return { quoteId: approved.id, hadPriorAccept };
}

export async function updateQuoteReviewToolResult(params: {
  toolResultId: string;
  sessionId: string;
  output: QuoteReviewOutput;
  status?: "pending" | "success" | "dismissed";
}) {
  return updateToolResult({
    toolResultId: params.toolResultId,
    sessionId: params.sessionId,
    output: params.output,
    status: params.status ?? "pending",
  });
}

export async function finalizeQuoteReview(params: {
  sessionId: string;
  toolResultId: string;
}): Promise<QuoteReviewOutput | null> {
  const existing = await getToolResultForSession(
    params.toolResultId,
    params.sessionId
  );
  if (!existing) {
    throw new Error("Tool result not found");
  }

  const output = readQuoteReviewOutput(existing.output);
  if (!output) {
    return null;
  }

  await updateToolResult({
    toolResultId: params.toolResultId,
    sessionId: params.sessionId,
    output,
    status: "success",
  });

  return output;
}

export async function loadAcceptedInsightIdsForMeeting(
  meetingId: string,
  themeIds: string[]
): Promise<string[]> {
  if (themeIds.length === 0) {
    return [];
  }

  const rows = await db
    .select({ id: insights.id })
    .from(insights)
    .where(
      and(
        eq(insights.meetingId, meetingId),
        inArray(insights.id, themeIds),
        eq(insights.accepted, true)
      )
    );

  return rows.map((row) => row.id);
}
