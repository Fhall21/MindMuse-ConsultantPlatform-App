import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedApiUser } from "@/lib/api/route-helpers";
import { getUnarchivedSessionForUser } from "@/lib/chat/context";
import { maybeInsertCardCompletionFollowUp } from "@/lib/chat/card-completion-follow-up";
import {
  getToolResultForSession,
  updateToolResult,
} from "@/lib/chat/persist";
import { meetingDraftSchema } from "@/lib/chat/tools/intake";
import {
  readThemeReviewOutput,
  themeReviewItemSchema,
} from "@/lib/chat/tools/themes";
import {
  mergeQuoteDecision,
  attachDbQuoteId,
} from "@/lib/chat/quotes-db";
import { mergeThemeDecision } from "@/lib/chat/themes-db";
import {
  readQuoteReviewOutput,
  quoteReviewItemSchema,
  quoteDecisionSchema,
} from "@/lib/chat/tools/quotes";
import {
  readGroupingReviewOutput,
  groupingThemeOptionSchema,
} from "@/lib/chat/tools/grouping";
import {
  readEmailDraftReviewOutput,
  readReportDraftReviewOutput,
  readResearchQuestionReviewOutput,
  researchQuestionSchema,
} from "@/lib/chat/tools/async-actions";

const themeDecisionSchema = z.enum(["accepted", "rejected"]);

const patchSchema = z.object({
  sessionId: z.string().uuid(),
  status: z.enum(["pending", "success", "dismissed"]).optional(),
  meeting_draft: meetingDraftSchema.optional(),
  meeting_id: z.string().uuid().optional(),
  consultation_id: z.string().uuid().optional(),
  themes: z.array(themeReviewItemSchema).optional(),
  theme_decisions: z.record(z.string().uuid(), themeDecisionSchema).optional(),
  quotes: z.array(quoteReviewItemSchema).optional(),
  quote_decisions: z.record(z.string().uuid(), quoteDecisionSchema).optional(),
  db_quote_ids: z.record(z.string().uuid(), z.string().uuid()).optional(),
  group_name: z.string().optional(),
  group_description: z.string().optional(),
  theme_ids: z.array(z.string().uuid()).optional(),
  rationale: z.string().optional(),
  available_themes: z.array(groupingThemeOptionSchema).optional(),
  questions: z.array(researchQuestionSchema).optional(),
  dismissed_question_ids: z.array(z.string().uuid()).optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
  edited_body: z.string().optional(),
  supporting_quotes: z.array(z.record(z.string(), z.unknown())).optional(),
  linked_themes: z.array(z.record(z.string(), z.unknown())).optional(),
  title: z.string().optional(),
  generated_at: z.string().optional(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedApiUser();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id: toolResultId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON payload" }, { status: 422 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { detail: parsed.error.issues[0]?.message ?? "Invalid tool result payload" },
      { status: 422 }
    );
  }

  const session = await getUnarchivedSessionForUser(auth.id, parsed.data.sessionId);
  if (!session) {
    return NextResponse.json({ detail: "Chat session not found" }, { status: 404 });
  }

  const existing = await getToolResultForSession(toolResultId, parsed.data.sessionId);
  if (!existing) {
    return NextResponse.json({ detail: "Tool result not found" }, { status: 404 });
  }

  const existingOutput =
    typeof existing.output === "object" && existing.output
      ? (existing.output as Record<string, unknown>)
      : {};

  const existingReview = readThemeReviewOutput(existing.output);

  let nextOutput: Record<string, unknown> = { ...existingOutput };

  if (parsed.data.meeting_draft !== undefined) {
    nextOutput = {
      ...nextOutput,
      ...parsed.data.meeting_draft,
    };
  }

  if (existingReview || parsed.data.themes || parsed.data.meeting_id) {
    const baseReview =
      existingReview ??
      (parsed.data.meeting_id && parsed.data.themes
        ? {
            meeting_id: parsed.data.meeting_id,
            themes: parsed.data.themes,
            decisions: {},
          }
        : null);

    if (baseReview) {
      let review = {
        ...baseReview,
        ...(parsed.data.meeting_id ? { meeting_id: parsed.data.meeting_id } : {}),
        ...(parsed.data.themes ? { themes: parsed.data.themes } : {}),
      };

      if (parsed.data.theme_decisions) {
        for (const [themeId, decision] of Object.entries(parsed.data.theme_decisions)) {
          review = mergeThemeDecision(review, themeId, decision);
        }
      }

      nextOutput = review;
    }
  }

  const existingQuoteReview = readQuoteReviewOutput(existing.output);
  if (existingQuoteReview || parsed.data.quotes || parsed.data.meeting_id) {
    const baseQuoteReview =
      existingQuoteReview ??
      (parsed.data.meeting_id && parsed.data.quotes
        ? {
            meeting_id: parsed.data.meeting_id,
            quotes: parsed.data.quotes,
            decisions: {},
            db_quote_ids: {},
          }
        : null);

    if (baseQuoteReview) {
      let review = {
        ...baseQuoteReview,
        ...(parsed.data.meeting_id ? { meeting_id: parsed.data.meeting_id } : {}),
        ...(parsed.data.quotes ? { quotes: parsed.data.quotes } : {}),
        ...(parsed.data.db_quote_ids ? { db_quote_ids: parsed.data.db_quote_ids } : {}),
      };

      if (parsed.data.quote_decisions) {
        for (const [quoteId, decision] of Object.entries(parsed.data.quote_decisions)) {
          review = mergeQuoteDecision(review, quoteId, decision);
        }
      }

      if (parsed.data.db_quote_ids) {
        for (const [cardId, dbId] of Object.entries(parsed.data.db_quote_ids)) {
          review = attachDbQuoteId(review, cardId, dbId);
        }
      }

      nextOutput = review;
    }
  }

  const existingGrouping = readGroupingReviewOutput(existing.output);
  if (
    existingGrouping ||
    parsed.data.group_name ||
    parsed.data.theme_ids ||
    parsed.data.available_themes
  ) {
    const base =
      existingGrouping ??
      (parsed.data.consultation_id || parsed.data.meeting_id
        ? {
            consultation_id:
              typeof parsed.data.consultation_id === "string"
                ? parsed.data.consultation_id
                : "",
            group_name: parsed.data.group_name ?? "",
            group_description: parsed.data.group_description ?? "",
            theme_ids: parsed.data.theme_ids ?? [],
            rationale: parsed.data.rationale ?? "",
            available_themes: parsed.data.available_themes ?? [],
          }
        : null);

    if (base) {
      nextOutput = {
        ...base,
        ...(parsed.data.consultation_id ? { consultation_id: parsed.data.consultation_id } : {}),
        ...(parsed.data.group_name !== undefined ? { group_name: parsed.data.group_name } : {}),
        ...(parsed.data.group_description !== undefined
          ? { group_description: parsed.data.group_description }
          : {}),
        ...(parsed.data.theme_ids ? { theme_ids: parsed.data.theme_ids } : {}),
        ...(parsed.data.rationale !== undefined ? { rationale: parsed.data.rationale } : {}),
        ...(parsed.data.available_themes
          ? { available_themes: parsed.data.available_themes }
          : {}),
      };
    }
  }

  const existingResearch = readResearchQuestionReviewOutput(existing.output);
  if (existingResearch || parsed.data.questions) {
    const base =
      existingResearch ??
      (parsed.data.consultation_id && parsed.data.questions
        ? {
            consultation_id: parsed.data.consultation_id,
            questions: parsed.data.questions,
            dismissed_question_ids: parsed.data.dismissed_question_ids ?? [],
          }
        : null);

    if (base) {
      nextOutput = {
        ...base,
        ...(parsed.data.questions ? { questions: parsed.data.questions } : {}),
        ...(parsed.data.dismissed_question_ids
          ? { dismissed_question_ids: parsed.data.dismissed_question_ids }
          : {}),
      };
    }
  }

  const existingEmail = readEmailDraftReviewOutput(existing.output);
  if (existingEmail || parsed.data.subject || parsed.data.body) {
    if (existingEmail) {
      nextOutput = {
        ...existingEmail,
        ...(parsed.data.subject !== undefined ? { subject: parsed.data.subject } : {}),
        ...(parsed.data.body !== undefined ? { body: parsed.data.body } : {}),
        ...(parsed.data.edited_body !== undefined ? { edited_body: parsed.data.edited_body } : {}),
        ...(parsed.data.supporting_quotes
          ? { supporting_quotes: parsed.data.supporting_quotes }
          : {}),
        ...(parsed.data.linked_themes ? { linked_themes: parsed.data.linked_themes } : {}),
      };
    }
  }

  const existingReport = readReportDraftReviewOutput(existing.output);
  if (existingReport || parsed.data.title || parsed.data.body) {
    if (existingReport) {
      nextOutput = {
        ...existingReport,
        ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
        ...(parsed.data.body !== undefined ? { body: parsed.data.body } : {}),
        ...(parsed.data.generated_at ? { generated_at: parsed.data.generated_at } : {}),
      };
    }
  }

  const nextStatus = parsed.data.status ?? existing.status ?? "pending";

  const updated = await updateToolResult({
    toolResultId,
    sessionId: parsed.data.sessionId,
    output: nextOutput,
    status: nextStatus,
  });

  if (updated) {
    await maybeInsertCardCompletionFollowUp({
      sessionId: parsed.data.sessionId,
      toolName: existing.toolName,
      previousStatus: existing.status,
      nextStatus,
      output: nextOutput,
    });
  }

  return NextResponse.json(updated);
}
