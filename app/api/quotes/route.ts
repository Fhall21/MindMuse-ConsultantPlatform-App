import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedApiUser } from "@/lib/api/route-helpers";
import { getUnarchivedSessionForUser } from "@/lib/chat/context";
import {
  acceptQuoteForMeeting,
  attachDbQuoteId,
  mergeQuoteDecision,
  updateQuoteReviewToolResult,
} from "@/lib/chat/quotes-db";
import { getToolResultForSession } from "@/lib/chat/persist";
import { readQuoteReviewOutput } from "@/lib/chat/tools/quotes";

const postSchema = z.object({
  meeting_id: z.string().uuid(),
  card_quote_id: z.string().uuid(),
  theme_id: z.string().uuid(),
  text: z.string().min(1),
  span_start: z.number().int().nonnegative(),
  span_end: z.number().int().positive(),
  speaker: z.string().optional(),
  justification: z.string().optional(),
  context_before: z.string().optional(),
  context_after: z.string().optional(),
  relevance_strength: z.enum(["strong_match", "partial_support", "context", "weak"]).optional(),
  session_id: z.string().uuid().optional(),
  tool_result_id: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedApiUser();
  if (auth instanceof NextResponse) {
    return auth;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON payload" }, { status: 422 });
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { detail: parsed.error.issues[0]?.message ?? "Invalid quote payload" },
      { status: 422 }
    );
  }

  const {
    meeting_id,
    card_quote_id,
    theme_id,
    text,
    span_start,
    span_end,
    speaker,
    justification,
    context_before,
    context_after,
    relevance_strength,
    session_id,
    tool_result_id,
  } = parsed.data;

  if (session_id) {
    const session = await getUnarchivedSessionForUser(auth.id, session_id);
    if (!session) {
      return NextResponse.json({ detail: "Chat session not found" }, { status: 404 });
    }
  }

  if (tool_result_id && session_id) {
    const existing = await getToolResultForSession(tool_result_id, session_id);
    if (!existing) {
      return NextResponse.json({ detail: "Tool result not found" }, { status: 404 });
    }
  }

  try {
    const { quoteId } = await acceptQuoteForMeeting({
      userId: auth.id,
      sessionId: session_id,
      meetingId: meeting_id,
      cardQuoteId: card_quote_id,
      themeId: theme_id,
      text,
      spanStart: span_start,
      spanEnd: span_end,
      speaker,
      justification,
      contextBefore: context_before,
      contextAfter: context_after,
      relevanceStrength: relevance_strength,
      toolResultId: tool_result_id,
    });

    if (tool_result_id && session_id) {
      const existing = await getToolResultForSession(tool_result_id, session_id);
      const reviewOutput = existing ? readQuoteReviewOutput(existing.output) : null;
      if (reviewOutput) {
        let nextOutput = mergeQuoteDecision(reviewOutput, card_quote_id, "accepted");
        nextOutput = attachDbQuoteId(nextOutput, card_quote_id, quoteId);
        await updateQuoteReviewToolResult({
          toolResultId: tool_result_id,
          sessionId: session_id,
          output: nextOutput,
          status: "pending",
        });
      }
    }

    return NextResponse.json({ id: quoteId, status: "approved" });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Failed to save quote";
    return NextResponse.json({ detail }, { status: 500 });
  }
}
