import { NextResponse } from "next/server";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { chatMessages, chatSessions, chatToolResults } from "@/db/schema";
import { requireAuthenticatedApiUser } from "@/lib/api/route-helpers";
import { getCardConfirmationMessage } from "@/lib/chat/card-confirmation-copy";
import { readBulkDismissProposal } from "@/lib/chat/tools/nl-actions";

const requestSchema = z.object({
  sessionId: z.string().uuid(),
  toolResultId: z.string().uuid(),
  itemIds: z.array(z.string().uuid()).max(10),
});

export async function POST(request: Request) {
  const auth = await requireAuthenticatedApiUser();
  if (auth instanceof NextResponse) return auth;

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ detail: "Invalid dismiss request" }, { status: 422 });
  }

  const { sessionId, toolResultId, itemIds } = parsed.data;
  const completed = await db.transaction(async (tx) => {
    const [ownedProposal] = await tx
      .select({ id: chatToolResults.id, output: chatToolResults.output })
      .from(chatToolResults)
      .innerJoin(chatSessions, eq(chatSessions.id, chatToolResults.sessionId))
      .where(
        and(
          eq(chatToolResults.id, toolResultId),
          eq(chatToolResults.sessionId, sessionId),
          eq(chatToolResults.toolName, "bulk_dismiss_pending"),
          eq(chatToolResults.status, "pending"),
          eq(chatSessions.userId, auth.id),
          isNull(chatSessions.archivedAt)
        )
      )
      .limit(1);
    if (!ownedProposal) return false;
    const proposal = readBulkDismissProposal(ownedProposal.output);
    const proposedIds = new Set(proposal?.items.map((item) => item.id) ?? []);
    if (!proposal || itemIds.some((id) => !proposedIds.has(id))) return false;

    if (itemIds.length > 0) {
      await tx
        .update(chatToolResults)
        .set({ status: "dismissed" })
        .where(
          and(
            eq(chatToolResults.sessionId, sessionId),
            eq(chatToolResults.status, "pending"),
            inArray(chatToolResults.id, itemIds)
          )
        );
    }

    await tx
      .update(chatToolResults)
      .set({ status: "success" })
      .where(
        and(
          eq(chatToolResults.id, toolResultId),
          eq(chatToolResults.sessionId, sessionId)
        )
      );
    await tx.insert(chatMessages).values({
      sessionId,
      role: "assistant",
      content: getCardConfirmationMessage("pending_items_dismissed"),
    });
    await tx
      .update(chatSessions)
      .set({ updatedAt: new Date() })
      .where(eq(chatSessions.id, sessionId));
    return true;
  });

  if (!completed) {
    return NextResponse.json({ detail: "Dismiss card not found" }, { status: 404 });
  }
  return NextResponse.json({ dismissed: itemIds.length });
}
