import { NextResponse } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { chatSessions, chatToolResults } from "@/db/schema";
import { requireAuthenticatedApiUser } from "@/lib/api/route-helpers";

// READ-ONLY — no side effects. Do NOT add writes here.
// Prior incident: research SSE + worker both submitted tasks independently (double cost + race).
export async function GET() {
  const auth = await requireAuthenticatedApiUser();
  if (auth instanceof NextResponse) return auth;

  const rows = await db
    .select({
      id: chatToolResults.id,
      toolName: chatToolResults.toolName,
      output: chatToolResults.output,
      createdAt: chatToolResults.createdAt,
    })
    .from(chatToolResults)
    .innerJoin(chatSessions, eq(chatToolResults.sessionId, chatSessions.id))
    .where(
      and(
        eq(chatSessions.userId, auth.id),
        eq(chatToolResults.toolName, "job_complete"),
        eq(chatToolResults.status, "success"),
        isNull(chatToolResults.seenAt)
      )
    )
    .orderBy(desc(chatToolResults.createdAt))
    .limit(20);

  return NextResponse.json({ notifications: rows });
}

export async function POST() {
  return NextResponse.json({ detail: "Method not allowed" }, { status: 405 });
}

export async function PUT() {
  return NextResponse.json({ detail: "Method not allowed" }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({ detail: "Method not allowed" }, { status: 405 });
}
