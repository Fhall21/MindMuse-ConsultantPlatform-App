// NOTE: NOT a "use server" file. These functions are called from API route
// handlers (server context) — adding "use server" would force every export to
// be an async function, which the error classes below cannot satisfy.
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  auditLog,
  canvasResearchInsights,
  insightQuotes,
  insights,
  researchSessions,
} from "@/db/schema";
import { AUDIT_ACTIONS } from "./audit-actions";
import { requireOwnedConsultation } from "@/lib/data/ownership";
import type {
  ExtractResearchInsightInput,
  PlaceResearchInsightInput,
} from "@/lib/validations/research-insight";

export class ResearchSessionNotFoundError extends Error {
  readonly code = "research_session_not_found";
  constructor() {
    super("Research session not found");
  }
}

export class ResearchInsightNotFoundError extends Error {
  readonly code = "research_insight_not_found";
  constructor() {
    super("Research insight not found");
  }
}

async function requireOwnedResearchSession(sessionId: string, userId: string) {
  const [row] = await db
    .select({ id: researchSessions.id })
    .from(researchSessions)
    .where(and(eq(researchSessions.id, sessionId), eq(researchSessions.userId, userId)))
    .limit(1);

  if (!row) throw new ResearchSessionNotFoundError();
  return row;
}

async function requireOwnedResearchInsight(insightId: string, userId: string) {
  const [row] = await db
    .select({ id: insights.id, researchSessionId: insights.researchSessionId })
    .from(insights)
    .innerJoin(
      researchSessions,
      eq(insights.researchSessionId, researchSessions.id)
    )
    .where(and(eq(insights.id, insightId), eq(researchSessions.userId, userId)))
    .limit(1);

  if (!row) throw new ResearchInsightNotFoundError();
  return row;
}

export async function extractResearchInsight(
  userId: string,
  input: ExtractResearchInsightInput
) {
  await requireOwnedConsultation(input.consultationId, userId);
  await requireOwnedResearchSession(input.researchSessionId, userId);

  return await db.transaction(async (tx) => {
    const [insight] = await tx
      .insert(insights)
      .values({
        researchSessionId: input.researchSessionId,
        label: input.label,
        description: input.description ?? null,
        isUserAdded: true,
        accepted: true,
      })
      .returning();

    const [quote] = await tx
      .insert(insightQuotes)
      .values({
        insightId: insight.id,
        researchSessionId: input.researchSessionId,
        quote: input.quote,
        locator: input.locator,
      })
      .returning();

    const [placement] = await tx
      .insert(canvasResearchInsights)
      .values({
        consultationId: input.consultationId,
        insightId: insight.id,
        positionX: input.positionX ?? null,
        positionY: input.positionY ?? null,
      })
      .returning();

    await tx.insert(auditLog).values({
      userId,
      action: AUDIT_ACTIONS.RESEARCH_INSIGHT_EXTRACTED,
      entityType: "insight",
      entityId: insight.id,
      meetingId: null,
      payload: {
        consultationId: input.consultationId,
        researchSessionId: input.researchSessionId,
        quoteId: quote.id,
        quoteLength: input.quote.length,
        locator: input.locator,
      },
    });

    return { insight, quote, placement };
  });
}

export async function placeResearchInsightOnCanvas(
  userId: string,
  input: PlaceResearchInsightInput
) {
  await requireOwnedConsultation(input.consultationId, userId);
  await requireOwnedResearchInsight(input.insightId, userId);

  return await db.transaction(async (tx) => {
    const [placement] = await tx
      .insert(canvasResearchInsights)
      .values({
        consultationId: input.consultationId,
        insightId: input.insightId,
        positionX: input.positionX ?? null,
        positionY: input.positionY ?? null,
      })
      .onConflictDoUpdate({
        target: [canvasResearchInsights.consultationId, canvasResearchInsights.insightId],
        set: {
          positionX: input.positionX ?? null,
          positionY: input.positionY ?? null,
        },
      })
      .returning();

    await tx.insert(auditLog).values({
      userId,
      action: AUDIT_ACTIONS.RESEARCH_INSIGHT_PLACED,
      entityType: "insight",
      entityId: input.insightId,
      meetingId: null,
      payload: {
        consultationId: input.consultationId,
      },
    });

    return { placement };
  });
}

export async function removeResearchInsightFromCanvas(
  userId: string,
  consultationId: string,
  insightId: string
) {
  await requireOwnedConsultation(consultationId, userId);
  await requireOwnedResearchInsight(insightId, userId);

  return await db.transaction(async (tx) => {
    await tx
      .delete(canvasResearchInsights)
      .where(
        and(
          eq(canvasResearchInsights.consultationId, consultationId),
          eq(canvasResearchInsights.insightId, insightId)
        )
      );

    await tx.insert(auditLog).values({
      userId,
      action: AUDIT_ACTIONS.RESEARCH_INSIGHT_REMOVED_FROM_CANVAS,
      entityType: "insight",
      entityId: insightId,
      meetingId: null,
      payload: { consultationId },
    });
  });
}
