import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  chatMessages,
  chatSessions,
  chatToolResults,
  meetingPeople,
  meetingTypes,
  meetings,
  people,
} from "@/db/schema";
import { extractMeetingHintFromMessage, titleMatchesMeetingHint } from "./meeting-hints";
import { isMeetingActionContinuation } from "./tools/meeting-action";

export const CURRENT_MEETING_CONTEXT_TOOL = "current_meeting_context";

export interface CurrentMeetingContext {
  meeting_id: string;
  consultation_id: string | null;
  title: string;
  meeting_date: string | null;
  meeting_type_id: string | null;
  meeting_type_label: string | null;
  people_names: string[];
  source_tool_name?: string;
}

export function readCurrentMeetingContext(output: unknown): CurrentMeetingContext | null {
  if (!output || typeof output !== "object") return null;
  const record = output as Record<string, unknown>;
  if (typeof record.meeting_id !== "string" || typeof record.title !== "string") {
    return null;
  }
  return {
    meeting_id: record.meeting_id,
    consultation_id:
      typeof record.consultation_id === "string" ? record.consultation_id : null,
    title: record.title,
    meeting_date: typeof record.meeting_date === "string" ? record.meeting_date : null,
    meeting_type_id:
      typeof record.meeting_type_id === "string" ? record.meeting_type_id : null,
    meeting_type_label:
      typeof record.meeting_type_label === "string" ? record.meeting_type_label : null,
    people_names: Array.isArray(record.people_names)
      ? record.people_names.filter((name): name is string => typeof name === "string")
      : [],
    source_tool_name:
      typeof record.source_tool_name === "string" ? record.source_tool_name : undefined,
  };
}

export function extractMeetingIdFromPayload(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.meeting_id === "string") return record.meeting_id;
  if (Array.isArray(record.meeting_ids) && typeof record.meeting_ids[0] === "string") {
    return record.meeting_ids[0];
  }
  return null;
}

async function buildMeetingSnapshot(params: {
  userId: string;
  meetingId: string;
  sourceToolName?: string;
}): Promise<CurrentMeetingContext | null> {
  const [row] = await db
    .select({
      id: meetings.id,
      title: meetings.title,
      consultationId: meetings.consultationId,
      meetingDate: meetings.meetingDate,
      meetingTypeId: meetings.meetingTypeId,
      meetingTypeLabel: meetingTypes.label,
    })
    .from(meetings)
    .leftJoin(meetingTypes, eq(meetingTypes.id, meetings.meetingTypeId))
    .where(
      and(
        eq(meetings.id, params.meetingId),
        eq(meetings.userId, params.userId),
        eq(meetings.isArchived, false)
      )
    )
    .limit(1);

  if (!row) return null;

  const linkedPeople = await db
    .select({ name: people.name })
    .from(meetingPeople)
    .innerJoin(people, eq(people.id, meetingPeople.personId))
    .where(
      and(eq(meetingPeople.meetingId, params.meetingId), eq(people.userId, params.userId))
    );

  return {
    meeting_id: row.id,
    consultation_id: row.consultationId ?? null,
    title: row.title,
    meeting_date: row.meetingDate?.toISOString() ?? null,
    meeting_type_id: row.meetingTypeId ?? null,
    meeting_type_label: row.meetingTypeLabel ?? null,
    people_names: linkedPeople.map((person) => person.name).sort((a, b) => a.localeCompare(b)),
    ...(params.sourceToolName ? { source_tool_name: params.sourceToolName } : {}),
  };
}

export async function refreshCurrentMeetingContext(params: {
  userId: string;
  sessionId: string;
  meetingId: string;
  sourceToolName?: string;
}): Promise<CurrentMeetingContext | null> {
  const snapshot = await buildMeetingSnapshot(params);
  if (!snapshot) return null;

  const [message] = await db
    .insert(chatMessages)
    .values({
      sessionId: params.sessionId,
      role: "tool",
      content: JSON.stringify({
        tool: CURRENT_MEETING_CONTEXT_TOOL,
        input: { meeting_id: params.meetingId },
      }),
      toolCallId: CURRENT_MEETING_CONTEXT_TOOL,
    })
    .returning();

  const [row] = await db
    .insert(chatToolResults)
    .values({
      sessionId: params.sessionId,
      messageId: message.id,
      toolName: CURRENT_MEETING_CONTEXT_TOOL,
      input: { meeting_id: params.meetingId },
      output: snapshot,
      status: "success",
    })
    .returning();

  await db
    .update(chatMessages)
    .set({
      content: JSON.stringify({
        tool: CURRENT_MEETING_CONTEXT_TOOL,
        input: { meeting_id: params.meetingId },
        output: snapshot,
        status: "success",
        toolResultId: row.id,
      }),
    })
    .where(eq(chatMessages.id, message.id));

  await db
    .update(chatSessions)
    .set({ updatedAt: new Date() })
    .where(eq(chatSessions.id, params.sessionId));

  return snapshot;
}

export async function getCurrentMeetingContextForSession(params: {
  userId: string;
  sessionId: string;
  consultationId?: string | null;
}): Promise<CurrentMeetingContext | null> {
  const rows = await db
    .select({
      toolName: chatToolResults.toolName,
      output: chatToolResults.output,
    })
    .from(chatToolResults)
    .where(
      and(
        eq(chatToolResults.sessionId, params.sessionId),
        eq(chatToolResults.status, "success")
      )
    )
    .orderBy(desc(chatToolResults.createdAt))
    .limit(50);

  for (const row of rows) {
    const current = readCurrentMeetingContext(row.output);
    const meetingId = current?.meeting_id ?? extractMeetingIdFromPayload(row.output);
    if (!meetingId) continue;

    const snapshot = await buildMeetingSnapshot({
      userId: params.userId,
      meetingId,
      sourceToolName: current?.source_tool_name ?? row.toolName,
    });
    if (!snapshot) continue;
    if (params.consultationId && snapshot.consultation_id !== params.consultationId) {
      continue;
    }
    return snapshot;
  }

  return null;
}

export function shouldReuseCurrentMeetingForMessage(
  current: CurrentMeetingContext,
  userMessage?: string | null
): boolean {
  const text = userMessage?.trim();
  if (!text) return true;
  if (isMeetingActionContinuation(text)) return true;

  const hint = extractMeetingHintFromMessage(text);
  if (!hint) return true;

  const normalizedHint = hint.toLowerCase();
  if (titleMatchesMeetingHint(current.title, hint)) return true;
  if (current.people_names.some((name) => name.toLowerCase().includes(normalizedHint))) {
    return true;
  }
  return Boolean(current.meeting_type_label?.toLowerCase().includes(normalizedHint));
}
