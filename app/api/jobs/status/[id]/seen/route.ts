import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { chatSessions, chatToolResults } from "@/db/schema";
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

  if (!row) {
    return NextResponse.json({ detail: "Not found" }, { status: 404 });
  }

  await db
    .update(chatToolResults)
    .set({ seenAt: new Date() })
    .where(eq(chatToolResults.id, id));

  return NextResponse.json({ ok: true });
}
