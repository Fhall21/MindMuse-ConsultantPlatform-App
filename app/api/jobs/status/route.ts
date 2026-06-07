import { NextResponse } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { chatSessions, chatToolResults, notifications, researchSessions } from "@/db/schema";
import { requireAuthenticatedApiUser } from "@/lib/api/route-helpers";

// READ-ONLY — no side effects. Do NOT add writes here.
// Prior incident: research SSE + worker both submitted tasks independently (double cost + race).
export async function GET() {
  const auth = await requireAuthenticatedApiUser();
  if (auth instanceof NextResponse) return auth;

  const [toolRows, researchRows, notificationRows] = await Promise.all([
    db
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
      .limit(20),
    db
      .select({
        id: researchSessions.id,
        sessionType: researchSessions.sessionType,
        query: researchSessions.query,
        completedAt: researchSessions.completedAt,
        updatedAt: researchSessions.updatedAt,
      })
      .from(researchSessions)
      .where(
        and(
          eq(researchSessions.userId, auth.id),
          eq(researchSessions.status, "complete"),
          isNull(researchSessions.seenAt)
        )
      )
      .orderBy(desc(researchSessions.completedAt))
      .limit(20),
    db
      .select({
        id: notifications.id,
        type: notifications.type,
        data: notifications.data,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, auth.id),
          isNull(notifications.seenAt)
        )
      )
      .orderBy(desc(notifications.createdAt))
      .limit(20),
  ]);

  const researchNotifications = researchRows.map((row) => ({
    id: row.id,
    toolName: "research_session_complete",
    output: {
      job_type: row.sessionType === "literature" ? "research_ready" : "analysis_complete",
      job_id: row.id,
      summary: row.query,
      action_url: `/research/${row.id}`,
    },
    createdAt: row.completedAt ?? row.updatedAt,
  }));

  const notificationsTableRows = notificationRows.map((row) => ({
    id: row.id,
    toolName: row.type,
    output: row.data ?? null,
    createdAt: row.createdAt,
  }));

  const allNotifications = [
    ...toolRows,
    ...researchNotifications,
    ...notificationsTableRows,
  ]
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(0, 20);

  return NextResponse.json({ notifications: allNotifications });
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
