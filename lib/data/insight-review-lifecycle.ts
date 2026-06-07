import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  gridCellInsights,
  insights,
  quoteInsightLinks,
  quotes,
} from "@/db/schema";

export type InsightReviewState = "pending" | "accepted" | "rejected" | "edited";
export type AppTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

type ReviewScope =
  | { kind: "junction"; junctionId: string }
  | { kind: "all" };

export async function syncInsightReviewLifecycle(
  tx: AppTransaction,
  params: {
    insightId: string;
    userId: string;
    state: InsightReviewState;
    scope: ReviewScope;
  }
) {
  const accepted = params.state === "accepted";
  const rejected = params.state === "rejected";
  const junctionWhere =
    params.scope.kind === "junction"
      ? and(
          eq(gridCellInsights.insightId, params.insightId),
          eq(gridCellInsights.id, params.scope.junctionId)
        )
      : eq(gridCellInsights.insightId, params.insightId);

  await tx
    .update(gridCellInsights)
    .set({
      gridReviewState: params.state,
      accepted,
      rejected,
      updatedAt: new Date(),
    })
    .where(junctionWhere);

  const junctions = await tx
    .select({
      accepted: gridCellInsights.accepted,
      rejected: gridCellInsights.rejected,
    })
    .from(gridCellInsights)
    .where(eq(gridCellInsights.insightId, params.insightId));

  const hasGridLinks = junctions.length > 0;
  const hasAnyAccepted = hasGridLinks
    ? junctions.some((junction) => junction.accepted)
    : accepted;
  const areAllRejected = hasGridLinks
    ? junctions.every((junction) => junction.rejected)
    : rejected;

  await tx
    .update(insights)
    .set({
      accepted: hasAnyAccepted,
      rejected: areAllRejected,
      rejectedAt: areAllRejected ? new Date() : null,
    })
    .where(eq(insights.id, params.insightId));

  const linkedQuotes = await tx
    .select({
      quoteId: quotes.id,
      status: quotes.status,
      approvalOrigin: quotes.approvalOrigin,
    })
    .from(quoteInsightLinks)
    .innerJoin(quotes, eq(quotes.id, quoteInsightLinks.quoteId))
    .where(eq(quoteInsightLinks.insightId, params.insightId));

  if (linkedQuotes.length === 0) {
    return { hasAnyAccepted, areAllRejected };
  }

  const quoteIds = linkedQuotes.map((quote) => quote.quoteId);
  await tx
    .update(quoteInsightLinks)
    .set({ linkType: hasAnyAccepted ? "durable" : "provisional" })
    .where(
      and(
        eq(quoteInsightLinks.insightId, params.insightId),
        inArray(quoteInsightLinks.quoteId, quoteIds)
      )
    );

  if (hasAnyAccepted) {
    const suggestedQuoteIds = linkedQuotes
      .filter((quote) => quote.status === "suggested")
      .map((quote) => quote.quoteId);

    if (suggestedQuoteIds.length > 0) {
      await tx
        .update(quotes)
        .set({
          status: "approved",
          approvalOrigin: "insight",
          approvedAt: new Date(),
          approvedBy: params.userId,
          rejectionReason: null,
          updatedAt: new Date(),
        })
        .where(inArray(quotes.id, suggestedQuoteIds));
    }

    return { hasAnyAccepted, areAllRejected };
  }

  for (const linkedQuote of linkedQuotes) {
    if (
      linkedQuote.status !== "approved" ||
      linkedQuote.approvalOrigin !== "insight"
    ) {
      continue;
    }

    const [otherAcceptedLink] = await tx
      .select({ insightId: quoteInsightLinks.insightId })
      .from(quoteInsightLinks)
      .innerJoin(insights, eq(insights.id, quoteInsightLinks.insightId))
      .where(
        and(
          eq(quoteInsightLinks.quoteId, linkedQuote.quoteId),
          eq(insights.accepted, true)
        )
      )
      .limit(1);

    if (otherAcceptedLink) continue;

    await tx
      .update(quotes)
      .set({
        status: "suggested",
        approvalOrigin: null,
        approvedAt: null,
        approvedBy: null,
        updatedAt: new Date(),
      })
      .where(eq(quotes.id, linkedQuote.quoteId));
  }

  return { hasAnyAccepted, areAllRejected };
}
