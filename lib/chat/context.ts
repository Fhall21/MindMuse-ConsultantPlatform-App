import { and, asc, count, desc, eq, inArray, isNull, max } from "drizzle-orm";
import { db } from "@/db/client";
import {
  chatMessages,
  chatSessions,
  consultations,
  meetingGroups,
  meetings,
  themes,
} from "@/db/schema";
import { listConsultationsForUser } from "@/lib/data/domain-read";

export interface ProjectContextSummary {
  projectId: string;
  projectName: string;
  meetingCount: number;
  themeCount: number;
  groupCount: number;
  lastActivityAt: string;
  activeEngagements: number;
}

export async function inferConsultationForSession(params: {
  userId: string;
  sessionId: string;
  consultationId: string | null;
}): Promise<string | null> {
  if (params.consultationId) {
    return params.consultationId;
  }

  const activeConsultations = await listConsultationsForUser(params.userId);
  if (activeConsultations.length === 1) {
    const [only] = activeConsultations;
    await db
      .update(chatSessions)
      .set({ consultationId: only.id, updatedAt: new Date() })
      .where(and(eq(chatSessions.id, params.sessionId), eq(chatSessions.userId, params.userId)));
    return only.id;
  }

  return null;
}

export async function buildProjectContextSummary(
  userId: string,
  consultationId: string | null
): Promise<ProjectContextSummary | null> {
  if (!consultationId) {
    const activeConsultations = await listConsultationsForUser(userId);
    return {
      projectId: "",
      projectName: "",
      meetingCount: 0,
      themeCount: 0,
      groupCount: 0,
      lastActivityAt: new Date(0).toISOString(),
      activeEngagements: activeConsultations.length,
    };
  }

  const [consultation] = await db
    .select({
      id: consultations.id,
      label: consultations.label,
    })
    .from(consultations)
    .where(and(eq(consultations.id, consultationId), eq(consultations.userId, userId)))
    .limit(1);

  if (!consultation) {
    return null;
  }

  const [
    meetingCountResult,
    themeCountResult,
    groupCountResult,
    lastMeetingActivity,
    lastThemeActivity,
    activeEngagementsResult,
  ] = await Promise.all([
    db
      .select({ count: count() })
      .from(meetings)
      .where(and(eq(meetings.userId, userId), eq(meetings.consultationId, consultationId))),
    db
      .select({ count: count() })
      .from(themes)
      .where(and(eq(themes.userId, userId), eq(themes.consultationId, consultationId))),
    db
      .select({ count: count() })
      .from(meetingGroups)
      .where(and(eq(meetingGroups.userId, userId), eq(meetingGroups.consultationId, consultationId))),
    db
      .select({ lastAt: max(meetings.updatedAt) })
      .from(meetings)
      .where(and(eq(meetings.userId, userId), eq(meetings.consultationId, consultationId))),
    db
      .select({ lastAt: max(themes.updatedAt) })
      .from(themes)
      .where(and(eq(themes.userId, userId), eq(themes.consultationId, consultationId))),
    db
      .select({ count: count() })
      .from(consultations)
      .where(eq(consultations.userId, userId)),
  ]);

  const meetingLast = lastMeetingActivity[0]?.lastAt ?? null;
  const themeLast = lastThemeActivity[0]?.lastAt ?? null;
  const lastActivity =
    meetingLast && themeLast
      ? meetingLast > themeLast
        ? meetingLast
        : themeLast
      : meetingLast ?? themeLast ?? new Date(0);

  return {
    projectId: consultation.id,
    projectName: consultation.label,
    meetingCount: meetingCountResult[0]?.count ?? 0,
    themeCount: themeCountResult[0]?.count ?? 0,
    groupCount: groupCountResult[0]?.count ?? 0,
    lastActivityAt: lastActivity.toISOString(),
    activeEngagements: activeEngagementsResult[0]?.count ?? 0,
  };
}

export async function countActiveConsultations(userId: string): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(consultations)
    .where(eq(consultations.userId, userId));
  return row?.count ?? 0;
}

export async function getUnarchivedSessionForUser(userId: string, sessionId?: string) {
  if (sessionId) {
    const [existing] = await db
      .select()
      .from(chatSessions)
      .where(
        and(
          eq(chatSessions.id, sessionId),
          eq(chatSessions.userId, userId),
          isNull(chatSessions.archivedAt)
        )
      )
      .limit(1);
    return existing ?? null;
  }

  const [latest] = await db
    .select()
    .from(chatSessions)
    .where(and(eq(chatSessions.userId, userId), isNull(chatSessions.archivedAt)))
    .orderBy(desc(chatSessions.updatedAt))
    .limit(1);

  return latest ?? null;
}

export async function createChatSession(userId: string, consultationId?: string | null) {
  const [session] = await db
    .insert(chatSessions)
    .values({
      userId,
      consultationId: consultationId ?? null,
    })
    .returning();
  return session;
}

export interface ChatSessionSummary {
  id: string;
  consultationId: string | null;
  consultationLabel: string | null;
  preview: string | null;
  messageCount: number;
  updatedAt: string;
  createdAt: string;
}

function truncatePreview(text: string, maxLength = 120): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

export async function listChatSessionsForUser(userId: string): Promise<ChatSessionSummary[]> {
  const sessions = await db
    .select({
      id: chatSessions.id,
      consultationId: chatSessions.consultationId,
      consultationLabel: consultations.label,
      updatedAt: chatSessions.updatedAt,
      createdAt: chatSessions.createdAt,
    })
    .from(chatSessions)
    .leftJoin(consultations, eq(chatSessions.consultationId, consultations.id))
    .where(and(eq(chatSessions.userId, userId), isNull(chatSessions.archivedAt)))
    .orderBy(desc(chatSessions.updatedAt))
    .limit(50);

  if (sessions.length === 0) {
    return [];
  }

  const sessionIds = sessions.map((session) => session.id);
  const [messageCounts, firstUserMessages] = await Promise.all([
    db
      .select({
        sessionId: chatMessages.sessionId,
        count: count(),
      })
      .from(chatMessages)
      .where(inArray(chatMessages.sessionId, sessionIds))
      .groupBy(chatMessages.sessionId),
    db
      .select({
        sessionId: chatMessages.sessionId,
        content: chatMessages.content,
      })
      .from(chatMessages)
      .where(
        and(
          inArray(chatMessages.sessionId, sessionIds),
          eq(chatMessages.role, "user")
        )
      )
      .orderBy(asc(chatMessages.createdAt)),
  ]);

  const countBySessionId = new Map(
    messageCounts.map((row) => [row.sessionId, row.count])
  );
  const previewBySessionId = new Map<string, string>();
  for (const row of firstUserMessages) {
    if (!previewBySessionId.has(row.sessionId)) {
      previewBySessionId.set(row.sessionId, truncatePreview(row.content));
    }
  }

  return sessions.map((session) => ({
    id: session.id,
    consultationId: session.consultationId,
    consultationLabel: session.consultationLabel,
    preview: previewBySessionId.get(session.id) ?? null,
    messageCount: countBySessionId.get(session.id) ?? 0,
    updatedAt: session.updatedAt.toISOString(),
    createdAt: session.createdAt.toISOString(),
  }));
}
