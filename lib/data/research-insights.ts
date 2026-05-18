"use server";

import { and, desc, eq, ilike, isNotNull, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  canvasResearchInsights,
  insightQuotes,
  insights,
  researchSessions,
} from "@/db/schema";

export interface ResearchInsightLibraryEntry {
  insightId: string;
  label: string;
  description: string | null;
  researchSessionId: string;
  researchSessionQuery: string;
  createdAt: string;
  quoteCount: number;
  placementCount: number;
}

/**
 * List the authenticated user's research-sourced insights — the personal library.
 * Filtered by case-insensitive substring match against label / quote / session query.
 */
export async function listResearchInsightLibrary(
  userId: string,
  query: string | null,
  limit = 50
): Promise<ResearchInsightLibraryEntry[]> {
  const trimmed = query?.trim() ?? "";
  const needle = trimmed.length > 0 ? `%${trimmed}%` : null;

  const rows = await db
    .select({
      insightId: insights.id,
      label: insights.label,
      description: insights.description,
      researchSessionId: insights.researchSessionId,
      researchSessionQuery: researchSessions.query,
      createdAt: insights.createdAt,
      quoteCount: sql<number>`(
        select count(*)::int from ${insightQuotes}
        where ${insightQuotes.insightId} = ${insights.id}
      )`,
      placementCount: sql<number>`(
        select count(*)::int from ${canvasResearchInsights}
        where ${canvasResearchInsights.insightId} = ${insights.id}
      )`,
    })
    .from(insights)
    .innerJoin(researchSessions, eq(insights.researchSessionId, researchSessions.id))
    .where(
      and(
        eq(researchSessions.userId, userId),
        isNotNull(insights.researchSessionId),
        needle
          ? or(
              ilike(insights.label, needle),
              ilike(researchSessions.query, needle),
              sql`exists (
                select 1 from ${insightQuotes}
                where ${insightQuotes.insightId} = ${insights.id}
                  and ${insightQuotes.quote} ilike ${needle}
              )`
            )
          : undefined
      )
    )
    .orderBy(desc(insights.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    insightId: r.insightId,
    label: r.label,
    description: r.description,
    researchSessionId: r.researchSessionId as string,
    researchSessionQuery: r.researchSessionQuery,
    createdAt:
      r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    quoteCount: r.quoteCount,
    placementCount: r.placementCount,
  }));
}

export interface ResearchInsightDetail extends ResearchInsightLibraryEntry {
  quotes: Array<{
    id: string;
    quote: string;
    locator: Record<string, unknown> | null;
    researchSessionId: string;
    createdAt: string;
  }>;
}

export async function getResearchInsightDetail(
  userId: string,
  insightId: string
): Promise<ResearchInsightDetail | null> {
  const [row] = await db
    .select({
      insightId: insights.id,
      label: insights.label,
      description: insights.description,
      researchSessionId: insights.researchSessionId,
      researchSessionQuery: researchSessions.query,
      createdAt: insights.createdAt,
    })
    .from(insights)
    .innerJoin(researchSessions, eq(insights.researchSessionId, researchSessions.id))
    .where(and(eq(insights.id, insightId), eq(researchSessions.userId, userId)))
    .limit(1);

  if (!row) return null;

  const quoteRows = await db
    .select()
    .from(insightQuotes)
    .where(eq(insightQuotes.insightId, insightId))
    .orderBy(insightQuotes.createdAt);

  return {
    insightId: row.insightId,
    label: row.label,
    description: row.description,
    researchSessionId: row.researchSessionId as string,
    researchSessionQuery: row.researchSessionQuery,
    createdAt:
      row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    quoteCount: quoteRows.length,
    placementCount: 0, // not loaded for detail; compute if needed
    quotes: quoteRows.map((q) => ({
      id: q.id,
      quote: q.quote,
      locator: q.locator,
      researchSessionId: q.researchSessionId,
      createdAt:
        q.createdAt instanceof Date ? q.createdAt.toISOString() : String(q.createdAt),
    })),
  };
}
