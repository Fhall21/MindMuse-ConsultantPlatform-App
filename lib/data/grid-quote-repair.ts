import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db/client";
import {
  auditLog,
  gridCellInsights,
  insights,
  quoteInsightLinks,
  quotes,
} from "@/db/schema";

export type GridQuoteRepairCounts = {
  manualOrigins: number;
  insightOrigins: number;
  demotedQuotes: number;
  durableLinks: number;
  provisionalLinks: number;
};

export async function repairGridQuoteLifecycle(): Promise<GridQuoteRepairCounts> {
  const counts: GridQuoteRepairCounts = {
    manualOrigins: 0,
    insightOrigins: 0,
    demotedQuotes: 0,
    durableLinks: 0,
    provisionalLinks: 0,
  };

  await db.transaction(async (tx) => {
    const gridLinkedRows = await tx
      .select({
        quoteId: quotes.id,
        status: quotes.status,
        approvalOrigin: quotes.approvalOrigin,
      })
      .from(quotes)
      .innerJoin(quoteInsightLinks, eq(quoteInsightLinks.quoteId, quotes.id))
      .innerJoin(
        gridCellInsights,
        eq(gridCellInsights.insightId, quoteInsightLinks.insightId)
      );

    const quoteIds = [...new Set(gridLinkedRows.map((row) => row.quoteId))];
    const quoteById = new Map(
      gridLinkedRows.map((row) => [
        row.quoteId,
        {
          status: row.status,
          approvalOrigin: row.approvalOrigin,
        },
      ])
    );

    const manualApprovalRows =
      quoteIds.length === 0
        ? []
        : await tx
            .select({ quoteId: auditLog.entityId })
            .from(auditLog)
            .where(
              and(
                or(
                  eq(auditLog.action, "quote.approved"),
                  eq(auditLog.action, "quote.manual_created")
                ),
                eq(auditLog.entityType, "quote"),
                inArray(auditLog.entityId, quoteIds)
              )
            );
    const manuallyApprovedQuoteIds = new Set(
      manualApprovalRows
        .map((row) => row.quoteId)
        .filter((id): id is string => Boolean(id))
    );

    for (const quoteId of quoteIds) {
      const quote = quoteById.get(quoteId);
      if (!quote || quote.status !== "approved") continue;

      if (manuallyApprovedQuoteIds.has(quoteId)) {
        if (quote.approvalOrigin !== "manual") {
          await tx
            .update(quotes)
            .set({ approvalOrigin: "manual", updatedAt: new Date() })
            .where(eq(quotes.id, quoteId));
          counts.manualOrigins += 1;
        }
        continue;
      }

      const [acceptedLink] = await tx
        .select({ insightId: quoteInsightLinks.insightId })
        .from(quoteInsightLinks)
        .innerJoin(insights, eq(insights.id, quoteInsightLinks.insightId))
        .where(
          and(
            eq(quoteInsightLinks.quoteId, quoteId),
            eq(insights.accepted, true)
          )
        )
        .limit(1);

      if (acceptedLink) {
        if (quote.approvalOrigin !== "insight") {
          await tx
            .update(quotes)
            .set({ approvalOrigin: "insight", updatedAt: new Date() })
            .where(eq(quotes.id, quoteId));
          counts.insightOrigins += 1;
        }
      } else {
        await tx
          .update(quotes)
          .set({
            status: "suggested",
            approvalOrigin: null,
            approvedAt: null,
            approvedBy: null,
            updatedAt: new Date(),
          })
          .where(eq(quotes.id, quoteId));
        counts.demotedQuotes += 1;
      }
    }

    const gridLinkRows = await tx
      .select({
        quoteId: quoteInsightLinks.quoteId,
        insightId: quoteInsightLinks.insightId,
        linkType: quoteInsightLinks.linkType,
        insightAccepted: insights.accepted,
      })
      .from(quoteInsightLinks)
      .innerJoin(insights, eq(insights.id, quoteInsightLinks.insightId))
      .innerJoin(
        gridCellInsights,
        eq(gridCellInsights.insightId, quoteInsightLinks.insightId)
      );
    const linkByKey = new Map(
      gridLinkRows.map((row) => [
        `${row.quoteId}:${row.insightId}`,
        row,
      ])
    );

    for (const link of linkByKey.values()) {
      const expectedType = link.insightAccepted ? "durable" : "provisional";
      if (link.linkType === expectedType) continue;

      await tx
        .update(quoteInsightLinks)
        .set({ linkType: expectedType })
        .where(
          and(
            eq(quoteInsightLinks.quoteId, link.quoteId),
            eq(quoteInsightLinks.insightId, link.insightId)
          )
        );
      if (expectedType === "durable") counts.durableLinks += 1;
      else counts.provisionalLinks += 1;
    }
  });

  return counts;
}
