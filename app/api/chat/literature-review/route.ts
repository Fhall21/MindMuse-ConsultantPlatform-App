import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { requireAuthenticatedApiUser } from "@/lib/api/route-helpers";
import { db } from "@/db/client";
import {
  chatMessages,
  chatSessions,
  chatToolResults,
  researchSessions,
} from "@/db/schema";
import { getCardConfirmationMessage } from "@/lib/chat/card-confirmation-copy";

const requestSchema = z.object({
  sessionId: z.string().uuid(),
  toolResultId: z.string().uuid(),
  query: z.string().trim().min(10),
  industry_ctx: z.string().trim().optional(),
});

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedApiUser();
  if (auth instanceof NextResponse) return auth;

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ detail: "Invalid literature review request" }, { status: 422 });
  }

  const { sessionId, toolResultId, query, industry_ctx } = parsed.data;

  const researchSession = await db.transaction(async (tx) => {
    const [ownedToolResult] = await tx
      .select({ id: chatToolResults.id })
      .from(chatToolResults)
      .innerJoin(chatSessions, eq(chatSessions.id, chatToolResults.sessionId))
      .where(
        and(
          eq(chatToolResults.id, toolResultId),
          eq(chatToolResults.sessionId, sessionId),
          eq(chatToolResults.toolName, "prepare_literature_review"),
          eq(chatToolResults.status, "pending"),
          eq(chatSessions.userId, auth.id),
          isNull(chatSessions.archivedAt)
        )
      )
      .limit(1);

    if (!ownedToolResult) return null;

    const [created] = await tx
      .insert(researchSessions)
      .values({
        userId: auth.id,
        sessionType: "literature",
        query,
        industryCtx: industry_ctx || null,
        status: "pending",
      })
      .returning({ id: researchSessions.id });

    await tx
      .update(chatToolResults)
      .set({
        status: "success",
        output: {
          query,
          industry_ctx: industry_ctx || null,
          research_session_id: created.id,
        },
      })
      .where(
        and(
          eq(chatToolResults.id, toolResultId),
          eq(chatToolResults.sessionId, sessionId)
        )
      );

    await tx.insert(chatMessages).values({
      sessionId,
      role: "assistant",
      content: getCardConfirmationMessage("literature_review_started"),
    });

    await tx
      .update(chatSessions)
      .set({ updatedAt: new Date() })
      .where(eq(chatSessions.id, sessionId));

    return created;
  });

  if (!researchSession) {
    return NextResponse.json({ detail: "Literature review card not found" }, { status: 404 });
  }

  return NextResponse.json({ id: researchSession.id });
}
