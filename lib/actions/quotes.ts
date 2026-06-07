"use server";

import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  gridCellInsights,
  gridCells,
  insights,
  meetings,
  people,
  quoteInsightLinks,
  quotes,
} from "@/db/schema";
import { requireCurrentUserId } from "@/lib/data/auth-context";
import { requireOwnedMeeting } from "@/lib/data/ownership";
import {
  computeCellConfidence,
  computeInsightConfidence,
} from "@/lib/quotes/insight-confidence";
import { AUDIT_ACTIONS } from "./audit-actions";
import { emitAuditEvent } from "./audit";

export type QuoteStatus = "suggested" | "approved" | "rejected";
export type QuoteSource = "ai" | "manual";
export type QuoteMaskRule = "role_workgroup" | "redact" | "none";
export type QuoteLinkType = "durable" | "provisional";

export interface QuoteRecord {
  id: string;
  meetingId: string;
  spanStart: number;
  spanEnd: number;
  exactText: string;
  speakerLabel: string | null;
  workGroupLabel: string | null;
  personId: string | null;
  status: QuoteStatus;
  source: QuoteSource;
  anonymousMaskRule: QuoteMaskRule;
  riskFlag: boolean;
  riskReason: string | null;
  rejectionReason: string | null;
  justification: string | null;
  contextBefore: string | null;
  contextAfter: string | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  links: Array<{
    insightId: string;
    insightLabel: string;
    isPrimary: boolean;
    linkType: QuoteLinkType;
    relevanceStrength?: "strong_match" | "partial_support" | "context" | "weak" | null;
  }>;
}

interface CreateQuoteParams {
  meetingId: string;
  spanStart: number;
  spanEnd: number;
  exactText: string;
  speakerLabel?: string | null;
  workGroupLabel?: string | null;
  personId?: string | null;
  source?: QuoteSource;
  riskFlag?: boolean;
  riskReason?: string | null;
  anonymousMaskRule?: QuoteMaskRule;
  justification?: string | null;
  contextBefore?: string | null;
  contextAfter?: string | null;
}

function trimToNull(value?: string | null) {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

async function loadQuoteWithLinks(quoteId: string): Promise<QuoteRecord | null> {
  const [quote] = await db
    .select()
    .from(quotes)
    .where(eq(quotes.id, quoteId))
    .limit(1);

  if (!quote) return null;

  const links = await db
    .select({
      insightId: quoteInsightLinks.insightId,
      insightLabel: insights.label,
      isPrimary: quoteInsightLinks.isPrimary,
      linkType: quoteInsightLinks.linkType,
      relevanceStrength: quoteInsightLinks.relevanceStrength,
    })
    .from(quoteInsightLinks)
    .innerJoin(insights, eq(insights.id, quoteInsightLinks.insightId))
    .where(eq(quoteInsightLinks.quoteId, quoteId))
    .orderBy(asc(quoteInsightLinks.createdAt));

  return {
    id: quote.id,
    meetingId: quote.meetingId,
    spanStart: quote.spanStart,
    spanEnd: quote.spanEnd,
    exactText: quote.exactText,
    speakerLabel: quote.speakerLabel,
    workGroupLabel: quote.workGroupLabel,
    personId: quote.personId,
    status: quote.status as QuoteStatus,
    source: quote.source as QuoteSource,
    anonymousMaskRule: quote.anonymousMaskRule as QuoteMaskRule,
    riskFlag: quote.riskFlag,
    riskReason: quote.riskReason,
    rejectionReason: quote.rejectionReason,
    justification: quote.justification,
    contextBefore: quote.contextBefore,
    contextAfter: quote.contextAfter,
    approvedAt: quote.approvedAt,
    createdAt: quote.createdAt,
    updatedAt: quote.updatedAt,
    links: links.map((link) => ({
      insightId: link.insightId,
      insightLabel: link.insightLabel,
      isPrimary: link.isPrimary,
      linkType: link.linkType as QuoteLinkType,
      relevanceStrength: link.relevanceStrength as any,
    })),
  };
}

export async function listQuotesForMeeting(
  meetingId: string,
  options: { status?: QuoteStatus | "all" } = {}
): Promise<QuoteRecord[]> {
  const userId = await requireCurrentUserId();
  await requireOwnedMeeting(meetingId, userId);

  const status = options.status ?? "all";
  const where =
    status === "all"
      ? eq(quotes.meetingId, meetingId)
      : and(eq(quotes.meetingId, meetingId), eq(quotes.status, status));

  const rows = await db
    .select({ id: quotes.id })
    .from(quotes)
    .where(where)
    .orderBy(asc(quotes.spanStart), asc(quotes.createdAt));

  const records = await Promise.all(rows.map((row) => loadQuoteWithLinks(row.id)));
  return records.filter((value): value is QuoteRecord => value !== null);
}

async function captureSpeakerContext(
  meetingId: string,
  personId: string | null
): Promise<{ speakerLabel: string | null; workGroupLabel: string | null }> {
  if (!personId) {
    return { speakerLabel: null, workGroupLabel: null };
  }

  const [person] = await db
    .select({ name: people.name, workingGroup: people.workingGroup })
    .from(people)
    .where(eq(people.id, personId))
    .limit(1);

  if (!person) {
    return { speakerLabel: null, workGroupLabel: null };
  }

  return {
    speakerLabel: person.name,
    workGroupLabel: person.workingGroup ?? null,
  };
}

async function validateSpan(
  meetingId: string,
  spanStart: number,
  spanEnd: number,
  exactText: string
) {
  if (!Number.isInteger(spanStart) || !Number.isInteger(spanEnd)) {
    throw new Error("Quote span offsets must be integers.");
  }
  if (spanEnd <= spanStart) {
    throw new Error("Quote spanEnd must be greater than spanStart.");
  }
  if (!exactText.trim()) {
    throw new Error("Quote exactText is required.");
  }

  const [meeting] = await db
    .select({ transcriptRaw: meetings.transcriptRaw })
    .from(meetings)
    .where(eq(meetings.id, meetingId))
    .limit(1);

  if (!meeting) return { transcriptRaw: null };
  if (meeting.transcriptRaw == null) return { transcriptRaw: null };

  if (spanEnd > meeting.transcriptRaw.length) {
    throw new Error("Quote span exceeds transcript length.");
  }

  const slice = meeting.transcriptRaw.slice(spanStart, spanEnd);
  if (slice !== exactText) {
    throw new Error("Quote exactText does not match the transcript span.");
  }
  return { transcriptRaw: meeting.transcriptRaw };
}

export async function createQuote(params: CreateQuoteParams): Promise<QuoteRecord> {
  const userId = await requireCurrentUserId();
  await requireOwnedMeeting(params.meetingId, userId);

  const { transcriptRaw } = await validateSpan(
    params.meetingId,
    params.spanStart,
    params.spanEnd,
    params.exactText
  );

  let contextBefore = null;
  let contextAfter = null;
  if (transcriptRaw) {
    contextBefore = transcriptRaw.slice(Math.max(0, params.spanStart - 50), params.spanStart);
    contextAfter = transcriptRaw.slice(params.spanEnd, Math.min(transcriptRaw.length, params.spanEnd + 50));
  }

  const personId = trimToNull(params.personId ?? null);
  const speakerCtx = await captureSpeakerContext(params.meetingId, personId);

  const source: QuoteSource = params.source ?? "manual";
  const initialStatus: QuoteStatus = source === "manual" ? "approved" : "suggested";

  const [created] = await db
    .insert(quotes)
    .values({
      meetingId: params.meetingId,
      userId,
      spanStart: params.spanStart,
      spanEnd: params.spanEnd,
      exactText: params.exactText,
      speakerLabel: trimToNull(params.speakerLabel ?? speakerCtx.speakerLabel),
      workGroupLabel: trimToNull(params.workGroupLabel ?? speakerCtx.workGroupLabel),
      personId,
      status: initialStatus,
      source,
      anonymousMaskRule: params.anonymousMaskRule ?? "role_workgroup",
      riskFlag: params.riskFlag ?? false,
      riskReason: trimToNull(params.riskReason ?? null),
      justification: trimToNull(params.justification ?? null),
      contextBefore: params.contextBefore ?? contextBefore,
      contextAfter: params.contextAfter ?? contextAfter,
      approvedAt: initialStatus === "approved" ? new Date() : null,
      approvedBy: initialStatus === "approved" ? userId : null,
    })
    .returning({ id: quotes.id });

  await emitAuditEvent({
    consultationId: null,
    action:
      source === "manual" ? AUDIT_ACTIONS.QUOTE_MANUAL_CREATED : AUDIT_ACTIONS.QUOTE_SUGGESTED,
    entityType: "quote",
    entityId: created.id,
    metadata: {
      meetingId: params.meetingId,
      spanStart: params.spanStart,
      spanEnd: params.spanEnd,
      source,
      riskFlag: params.riskFlag ?? false,
    },
  });

  if (params.riskFlag) {
    await emitAuditEvent({
      consultationId: null,
      action: AUDIT_ACTIONS.QUOTE_RISK_FLAGGED,
      entityType: "quote",
      entityId: created.id,
      metadata: { reason: params.riskReason ?? null },
    });
  }

  const record = await loadQuoteWithLinks(created.id);
  if (!record) throw new Error("Failed to load created quote.");
  return record;
}

interface UpdateQuoteSpeakerParams {
  quoteId: string;
  speakerLabel: string | null;
}

export async function updateQuoteSpeaker(params: UpdateQuoteSpeakerParams): Promise<QuoteRecord> {
  const userId = await requireCurrentUserId();

  const [quote] = await db
    .update(quotes)
    .set({
      speakerLabel: params.speakerLabel,
      updatedAt: sql`now()`,
    })
    .where(eq(quotes.id, params.quoteId))
    .returning({ id: quotes.id });

  if (!quote) throw new Error("Quote not found");

  const record = await loadQuoteWithLinks(quote.id);
  if (!record) throw new Error("Failed to load updated quote.");
  return record;
}

interface UpdateQuoteSpanParams {
  quoteId: string;
  spanStart: number;
  spanEnd: number;
  exactText: string;
}

export async function updateQuoteSpan(params: UpdateQuoteSpanParams): Promise<QuoteRecord> {
  const userId = await requireCurrentUserId();

  const [quote] = await db
    .select()
    .from(quotes)
    .where(and(eq(quotes.id, params.quoteId), eq(quotes.userId, userId)))
    .limit(1);

  if (!quote) throw new Error("Quote not found");

  const { transcriptRaw } = await validateSpan(
    quote.meetingId,
    params.spanStart,
    params.spanEnd,
    params.exactText
  );

  let contextBefore = null;
  let contextAfter = null;
  if (transcriptRaw) {
    contextBefore = transcriptRaw.slice(Math.max(0, params.spanStart - 50), params.spanStart);
    contextAfter = transcriptRaw.slice(params.spanEnd, Math.min(transcriptRaw.length, params.spanEnd + 50));
  }

  await db
    .update(quotes)
    .set({
      spanStart: params.spanStart,
      spanEnd: params.spanEnd,
      exactText: params.exactText,
      contextBefore: quote.contextBefore ?? contextBefore,
      contextAfter: quote.contextAfter ?? contextAfter,
      updatedAt: sql`now()`,
    })
    .where(eq(quotes.id, params.quoteId));

  await emitAuditEvent({
    consultationId: null,
    action: "quote.updated" as any,
    entityType: "quote",
    entityId: quote.id,
    metadata: {
      meetingId: quote.meetingId,
      updatedFields: ["spanStart", "spanEnd", "exactText"]
    },
  });

  const record = await loadQuoteWithLinks(quote.id);
  if (!record) throw new Error("Failed to load updated quote.");
  return record;
}

interface ApproveQuoteParams {
  quoteId: string;
  /** Optional insightId to link as the primary insight at approval time. */
  primaryInsightId?: string | null;
  /** Optional set of additional insightIds to link (durable). */
  additionalInsightIds?: string[];
  relevanceStrength?: "strong_match" | "partial_support" | "context" | "weak" | null;
}

export async function approveQuote(params: ApproveQuoteParams): Promise<QuoteRecord> {
  const userId = await requireCurrentUserId();

  const [quote] = await db
    .select()
    .from(quotes)
    .where(and(eq(quotes.id, params.quoteId), eq(quotes.userId, userId)))
    .limit(1);

  if (!quote) throw new Error("Quote not found.");

  await db
    .update(quotes)
    .set({
      status: "approved",
      approvedAt: new Date(),
      approvedBy: userId,
      rejectionReason: null,
      updatedAt: new Date(),
    })
    .where(eq(quotes.id, params.quoteId));

  if (params.primaryInsightId) {
    await linkQuoteToInsightInternal({
      quoteId: params.quoteId,
      insightId: params.primaryInsightId,
      isPrimary: true,
      linkType: "durable",
      relevanceStrength: params.relevanceStrength ?? null,
    });
  }

  for (const insightId of params.additionalInsightIds ?? []) {
    if (insightId === params.primaryInsightId) continue;
    await linkQuoteToInsightInternal({
      quoteId: params.quoteId,
      insightId,
      isPrimary: false,
      linkType: "durable",
      relevanceStrength: params.relevanceStrength ?? null,
    });
  }

  await emitAuditEvent({
    consultationId: null,
    action: AUDIT_ACTIONS.QUOTE_APPROVED,
    entityType: "quote",
    entityId: params.quoteId,
    metadata: {
      meetingId: quote.meetingId,
      primaryInsightId: params.primaryInsightId ?? null,
      additionalInsightIds: params.additionalInsightIds ?? [],
    },
  });

  const record = await loadQuoteWithLinks(params.quoteId);
  if (!record) throw new Error("Failed to load approved quote.");
  return record;
}

interface RejectQuoteParams {
  quoteId: string;
  rejectionReason?: string | null;
}

export async function rejectQuote(params: RejectQuoteParams): Promise<QuoteRecord> {
  const userId = await requireCurrentUserId();

  const [quote] = await db
    .select()
    .from(quotes)
    .where(and(eq(quotes.id, params.quoteId), eq(quotes.userId, userId)))
    .limit(1);

  if (!quote) throw new Error("Quote not found.");

  await db
    .update(quotes)
    .set({
      status: "rejected",
      rejectionReason: trimToNull(params.rejectionReason ?? null),
      updatedAt: new Date(),
    })
    .where(eq(quotes.id, params.quoteId));

  await emitAuditEvent({
    consultationId: null,
    action: AUDIT_ACTIONS.QUOTE_REJECTED,
    entityType: "quote",
    entityId: params.quoteId,
    metadata: {
      meetingId: quote.meetingId,
      rejectionReason: params.rejectionReason ?? null,
    },
  });

  const record = await loadQuoteWithLinks(params.quoteId);
  if (!record) throw new Error("Failed to load rejected quote.");
  return record;
}

interface LinkQuoteParams {
  quoteId: string;
  insightId: string;
  isPrimary?: boolean;
  linkType?: QuoteLinkType;
  relevanceStrength?: "strong_match" | "partial_support" | "context" | "weak" | null;
}

async function assertInsightLinkableForQuote(params: {
  quoteId: string;
  insightId: string;
}) {
  const [row] = await db
    .select({
      quoteMeetingId: quotes.meetingId,
      insightMeetingId: insights.meetingId,
      accepted: insights.accepted,
      rejected: insights.rejected,
    })
    .from(quotes)
    .innerJoin(insights, eq(insights.id, params.insightId))
    .where(eq(quotes.id, params.quoteId))
    .limit(1);

  if (!row || row.quoteMeetingId !== row.insightMeetingId) {
    throw new Error("Insight not found for this quote.");
  }

  if (!row.accepted || row.rejected) {
    throw new Error("Only accepted insights can be linked to quotes.");
  }
}

async function linkQuoteToInsightInternal(params: Required<Omit<LinkQuoteParams, "isPrimary" | "linkType" | "relevanceStrength">> & {
  isPrimary: boolean;
  linkType: QuoteLinkType;
  relevanceStrength?: "strong_match" | "partial_support" | "context" | "weak" | null;
}) {
  await assertInsightLinkableForQuote({
    quoteId: params.quoteId,
    insightId: params.insightId,
  });

  if (params.isPrimary) {
    await db
      .update(quoteInsightLinks)
      .set({ isPrimary: false })
      .where(eq(quoteInsightLinks.quoteId, params.quoteId));
  }

  await db
    .insert(quoteInsightLinks)
    .values({
      quoteId: params.quoteId,
      insightId: params.insightId,
      isPrimary: params.isPrimary,
      linkType: params.linkType,
      relevanceStrength: params.relevanceStrength ?? null,
    })
    .onConflictDoUpdate({
      target: [quoteInsightLinks.quoteId, quoteInsightLinks.insightId],
      set: {
        isPrimary: params.isPrimary,
        linkType: params.linkType,
        relevanceStrength: params.relevanceStrength ?? null,
      },
    });
}

export async function linkQuoteToInsight(params: LinkQuoteParams): Promise<QuoteRecord> {
  const userId = await requireCurrentUserId();

  const [quote] = await db
    .select()
    .from(quotes)
    .where(and(eq(quotes.id, params.quoteId), eq(quotes.userId, userId)))
    .limit(1);

  if (!quote) throw new Error("Quote not found.");

  await linkQuoteToInsightInternal({
    quoteId: params.quoteId,
    insightId: params.insightId,
    isPrimary: params.isPrimary ?? false,
    linkType: params.linkType ?? "durable",
    relevanceStrength: params.relevanceStrength ?? null,
  });

  await emitAuditEvent({
    consultationId: null,
    action: params.isPrimary
      ? AUDIT_ACTIONS.QUOTE_PRIMARY_INSIGHT_SET
      : AUDIT_ACTIONS.QUOTE_INSIGHT_LINKED,
    entityType: "quote",
    entityId: params.quoteId,
    metadata: {
      insightId: params.insightId,
      linkType: params.linkType ?? "durable",
      isPrimary: params.isPrimary ?? false,
    },
  });

  const record = await loadQuoteWithLinks(params.quoteId);
  if (!record) throw new Error("Failed to load linked quote.");
  return record;
}

interface UnlinkQuoteParams {
  quoteId: string;
  insightId: string;
}

export async function unlinkQuoteFromInsight(params: UnlinkQuoteParams): Promise<QuoteRecord> {
  const userId = await requireCurrentUserId();

  const [quote] = await db
    .select()
    .from(quotes)
    .where(and(eq(quotes.id, params.quoteId), eq(quotes.userId, userId)))
    .limit(1);

  if (!quote) throw new Error("Quote not found.");

  await db.transaction(async (tx) => {
    await tx
      .delete(quoteInsightLinks)
      .where(
        and(
          eq(quoteInsightLinks.quoteId, params.quoteId),
          eq(quoteInsightLinks.insightId, params.insightId)
        )
      );

    // If the deleted link was primary, promote the oldest remaining link.
    const remaining = await tx
      .select({
        insightId: quoteInsightLinks.insightId,
        isPrimary: quoteInsightLinks.isPrimary,
        createdAt: quoteInsightLinks.createdAt,
      })
      .from(quoteInsightLinks)
      .where(eq(quoteInsightLinks.quoteId, params.quoteId))
      .orderBy(asc(quoteInsightLinks.createdAt));

    if (remaining.length > 0 && !remaining.some((row) => row.isPrimary)) {
      await tx
        .update(quoteInsightLinks)
        .set({ isPrimary: true })
        .where(
          and(
            eq(quoteInsightLinks.quoteId, params.quoteId),
            eq(quoteInsightLinks.insightId, remaining[0].insightId)
          )
        );
    }

    const impactedCells = await tx
      .select({
        gridCellId: gridCellInsights.gridCellId,
      })
      .from(gridCellInsights)
      .where(eq(gridCellInsights.insightId, params.insightId));

    const impactedCellIds = [...new Set(impactedCells.map((row) => row.gridCellId))];
    if (impactedCellIds.length > 0) {
      const cellInsights = await tx
        .select({
          gridCellId: gridCellInsights.gridCellId,
          insightId: gridCellInsights.insightId,
        })
        .from(gridCellInsights)
        .where(inArray(gridCellInsights.gridCellId, impactedCellIds));

      const cellLinks = await tx
        .select({
          gridCellId: gridCellInsights.gridCellId,
          insightId: quoteInsightLinks.insightId,
          relevanceStrength: quoteInsightLinks.relevanceStrength,
        })
        .from(gridCellInsights)
        .innerJoin(
          quoteInsightLinks,
          eq(quoteInsightLinks.insightId, gridCellInsights.insightId)
        )
        .where(inArray(gridCellInsights.gridCellId, impactedCellIds));

      for (const cellId of impactedCellIds) {
        const insightIds = cellInsights
          .filter((row) => row.gridCellId === cellId)
          .map((row) => row.insightId);
        const insightConfidences = insightIds.map((insightId) =>
          computeInsightConfidence(
            cellLinks
              .filter(
                (link) => link.gridCellId === cellId && link.insightId === insightId
              )
              .map((link) => ({ relevanceStrength: link.relevanceStrength }))
          )
        );
        const cellConfidence = computeCellConfidence(insightConfidences);
        await tx
          .update(gridCells)
          .set({
            confidence: cellConfidence,
            quoteCount: cellLinks.filter((link) => link.gridCellId === cellId).length,
            updatedAt: sql`now()`,
          })
          .where(eq(gridCells.id, cellId));
      }
    }
  });

  await emitAuditEvent({
    consultationId: null,
    action: AUDIT_ACTIONS.QUOTE_INSIGHT_UNLINKED,
    entityType: "quote",
    entityId: params.quoteId,
    metadata: { insightId: params.insightId },
  });

  const record = await loadQuoteWithLinks(params.quoteId);
  if (!record) throw new Error("Failed to load unlinked quote.");
  return record;
}

/**
 * Idempotently insert a batch of AI-suggested quotes for a meeting. Suggestions
 * with the same span are deduplicated; existing approved/rejected quotes are
 * never overwritten.
 */
interface AISuggestion {
  spanStart: number;
  spanEnd: number;
  exactText: string;
  speakerLabel?: string | null;
  workGroupLabel?: string | null;
  personId?: string | null;
  riskFlag?: boolean;
  riskReason?: string | null;
  justification?: string | null;
  contextBefore?: string | null;
  contextAfter?: string | null;
}

export async function ingestAIQuoteSuggestions(
  meetingId: string,
  suggestions: AISuggestion[]
): Promise<QuoteRecord[]> {
  const userId = await requireCurrentUserId();
  await requireOwnedMeeting(meetingId, userId);

  const created: QuoteRecord[] = [];
  for (const suggestion of suggestions) {
    const existing = await db
      .select({ id: quotes.id })
      .from(quotes)
      .where(
        and(
          eq(quotes.meetingId, meetingId),
          eq(quotes.spanStart, suggestion.spanStart),
          eq(quotes.spanEnd, suggestion.spanEnd)
        )
      )
      .limit(1);

    if (existing.length > 0) continue;

    const record = await createQuote({
      meetingId,
      spanStart: suggestion.spanStart,
      spanEnd: suggestion.spanEnd,
      exactText: suggestion.exactText,
      speakerLabel: suggestion.speakerLabel ?? null,
      workGroupLabel: suggestion.workGroupLabel ?? null,
      personId: suggestion.personId ?? null,
      source: "ai",
      riskFlag: suggestion.riskFlag ?? false,
      riskReason: suggestion.riskReason ?? null,
      justification: suggestion.justification ?? null,
      contextBefore: suggestion.contextBefore ?? null,
      contextAfter: suggestion.contextAfter ?? null,
    });
    created.push(record);
  }

  return created;
}

/**
 * Count quotes by status for a meeting. Used by the analysis-stage UI badge.
 */
export async function getQuoteCountsForMeeting(
  meetingId: string
): Promise<Record<QuoteStatus, number>> {
  const userId = await requireCurrentUserId();
  await requireOwnedMeeting(meetingId, userId);

  const rows = await db
    .select({
      status: quotes.status,
      count: sql<number>`count(*)::int`,
    })
    .from(quotes)
    .where(eq(quotes.meetingId, meetingId))
    .groupBy(quotes.status);

  const counts: Record<QuoteStatus, number> = {
    suggested: 0,
    approved: 0,
    rejected: 0,
  };
  for (const row of rows) {
    const status = row.status as QuoteStatus;
    counts[status] = row.count;
  }
  return counts;
}
