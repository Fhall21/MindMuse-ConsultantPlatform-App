// Server-only helpers. Imported by API route handlers, not from client code.
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  canvasResearchInsights,
  insightQuotes,
  insights,
  researchSessions,
} from "@/db/schema";
import {
  extractResearchReferences,
  researchReferenceFullCite,
  researchSessionShortCite,
} from "@/lib/citations/short-cite";

export interface ReportReferenceQuote {
  id: string;
  quote: string;
  locator: Record<string, unknown> | null;
}

export interface ReportReference {
  /** 1-based number assigned for this report's References section. */
  number: number;
  insightId: string;
  insightLabel: string;
  researchSessionId: string;
  researchSessionQuery: string;
  /** Short cite, e.g. "Smith 2024". Suitable for the References list label. */
  shortCite: string;
  /** Full cite line for the References list body. */
  fullCite: string;
  /** Optional source URL of the underlying reference, when known. */
  sourceUrl: string | null;
  /** All quotes the user pulled from this research session into this insight. */
  quotes: ReportReferenceQuote[];
}

export interface ReportReferenceBundle {
  references: ReportReference[];
  /**
   * Map from insightId → reference number, used to inject inline `[N]` markers
   * when an insight label appears in the report body.
   */
  numberByInsightId: Map<string, number>;
  /**
   * Map from insightId → the underlying insight label, used when rewriting
   * report markdown to attach `[N]` markers to the right substrings.
   */
  labelByInsightId: Map<string, string>;
}

/**
 * Load the References bundle for a report scoped to a set of consultations.
 *
 * Dedupes by research_session_id in first-appearance order, so two insights
 * sourced from the same paper share one numbered reference. Numbering is
 * per-report (resets every export).
 */
export async function loadReportReferences(
  consultationIds: string[],
  userId: string
): Promise<ReportReferenceBundle> {
  if (consultationIds.length === 0) {
    return {
      references: [],
      numberByInsightId: new Map(),
      labelByInsightId: new Map(),
    };
  }

  const rows = await db
    .select({
      insight: insights,
      researchSession: researchSessions,
      placementCreatedAt: canvasResearchInsights.createdAt,
    })
    .from(canvasResearchInsights)
    .innerJoin(insights, eq(canvasResearchInsights.insightId, insights.id))
    .innerJoin(researchSessions, eq(insights.researchSessionId, researchSessions.id))
    .where(
      and(
        inArray(canvasResearchInsights.consultationId, consultationIds),
        eq(researchSessions.userId, userId)
      )
    )
    .orderBy(asc(canvasResearchInsights.createdAt));

  if (rows.length === 0) {
    return {
      references: [],
      numberByInsightId: new Map(),
      labelByInsightId: new Map(),
    };
  }

  const insightIds = Array.from(new Set(rows.map((r) => r.insight.id)));
  const quotesRows = await db
    .select()
    .from(insightQuotes)
    .where(inArray(insightQuotes.insightId, insightIds))
    .orderBy(asc(insightQuotes.createdAt));

  const quotesByInsight = new Map<string, ReportReferenceQuote[]>();
  for (const q of quotesRows) {
    const list = quotesByInsight.get(q.insightId) ?? [];
    list.push({ id: q.id, quote: q.quote, locator: q.locator });
    quotesByInsight.set(q.insightId, list);
  }

  // Dedupe by research_session_id, first appearance wins the slot. Multiple
  // insights sharing the same session collapse into a single References entry
  // whose quotes are unioned (one entry can cite multiple passages).
  const numberBySession = new Map<string, number>();
  const references: ReportReference[] = [];
  const numberByInsightId = new Map<string, number>();
  const labelByInsightId = new Map<string, string>();

  let nextNumber = 1;
  for (const { insight, researchSession } of rows) {
    labelByInsightId.set(insight.id, insight.label);

    let number = numberBySession.get(researchSession.id);
    if (number === undefined) {
      number = nextNumber++;
      numberBySession.set(researchSession.id, number);
      const refs = extractResearchReferences(researchSession);
      const firstRef = refs[0];
      references.push({
        number,
        insightId: insight.id,
        insightLabel: insight.label,
        researchSessionId: researchSession.id,
        researchSessionQuery: researchSession.query,
        shortCite: researchSessionShortCite(researchSession),
        fullCite: firstRef
          ? researchReferenceFullCite(firstRef)
          : `Research session: ${researchSession.query}`,
        sourceUrl: firstRef?.url ?? null,
        quotes: quotesByInsight.get(insight.id) ?? [],
      });
    } else {
      // Append additional quotes from a sibling insight onto the existing entry.
      const existing = references.find((r) => r.number === number);
      if (existing) {
        const extraQuotes = quotesByInsight.get(insight.id) ?? [];
        for (const q of extraQuotes) {
          if (!existing.quotes.find((eq) => eq.id === q.id)) {
            existing.quotes.push(q);
          }
        }
      }
    }
    numberByInsightId.set(insight.id, number);
  }

  return { references, numberByInsightId, labelByInsightId };
}

