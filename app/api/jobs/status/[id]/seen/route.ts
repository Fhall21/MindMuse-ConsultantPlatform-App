import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { chatSessions, chatToolResults, notifications, researchSessions } from "@/db/schema";
import { requireAuthenticatedApiUser } from "@/lib/api/route-helpers";

export async function PATCH(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedApiUser();
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;

  // Verify row belongs to this user before marking seen
  const [row] = await db
    .select({ id: chatToolResults.id })
    .from(chatToolResults)
    .innerJoin(chatSessions, eq(chatToolResults.sessionId, chatSessions.id))
    .where(and(eq(chatToolResults.id, id), eq(chatSessions.userId, auth.id)))
    .limit(1);

  if (row) {
    await db
      .update(chatToolResults)
      .set({ seenAt: new Date() })
      .where(eq(chatToolResults.id, id));

    return NextResponse.json({ ok: true });
  }

  const [researchSession] = await db
    .select({ id: researchSessions.id })
    .from(researchSessions)
    .where(and(eq(researchSessions.id, id), eq(researchSessions.userId, auth.id)))
    .limit(1);

  if (researchSession) {
    await db
      .update(researchSessions)
      .set({ seenAt: new Date() })
      .where(and(eq(researchSessions.id, id), eq(researchSessions.userId, auth.id)));

    return NextResponse.json({ ok: true });
  }

  const [notification] = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.id, id), eq(notifications.userId, auth.id)))
    .limit(1);

  if (!notification) {
    return NextResponse.json({ detail: "Not found" }, { status: 404 });
  }

  await db
    .update(notifications)
    .set({ seenAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.userId, auth.id)));

  return NextResponse.json({ ok: true });
}
