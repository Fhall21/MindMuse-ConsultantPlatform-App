import { and, asc, count, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { db } from "@/db/client";
import {
  chatMessages,
  chatSessions,
  chatToolResults,
  type ChatMessageRole,
  type ChatToolResultStatus,
} from "@/db/schema";
import type { ModelMessage } from "ai";
import { CHAT_MESSAGE_HISTORY_LIMIT } from "./constants";
import { getChatModel } from "./model";

const SUMMARY_MARKER = "[CHAT_HISTORY_SUMMARY]";

export async function loadRecentChatMessages(sessionId: string, limit = CHAT_MESSAGE_HISTORY_LIMIT) {
  const rows = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit);

  return rows.reverse();
}

export async function countSessionMessages(sessionId: string): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId));
  return row?.count ?? 0;
}

export async function insertChatMessage(params: {
  sessionId: string;
  role: ChatMessageRole;
  content: string;
  toolCallId?: string | null;
}) {
  const [message] = await db
    .insert(chatMessages)
    .values({
      sessionId: params.sessionId,
      role: params.role,
      content: params.content,
      toolCallId: params.toolCallId ?? null,
    })
    .returning();

  await db
    .update(chatSessions)
    .set({ updatedAt: new Date() })
    .where(eq(chatSessions.id, params.sessionId));

  return message;
}

export async function updateChatMessageContent(messageId: string, content: string) {
  await db
    .update(chatMessages)
    .set({ content })
    .where(eq(chatMessages.id, messageId));
}

export async function loadToolResultsForSession(sessionId: string) {
  return db
    .select()
    .from(chatToolResults)
    .where(eq(chatToolResults.sessionId, sessionId));
}

export async function insertToolResult(params: {
  sessionId: string;
  messageId: string;
  toolName: string;
  input: Record<string, unknown>;
  output?: unknown;
  status: ChatToolResultStatus;
}) {
  const [row] = await db
    .insert(chatToolResults)
    .values({
      sessionId: params.sessionId,
      messageId: params.messageId,
      toolName: params.toolName,
      input: params.input,
      output: params.output ?? null,
      status: params.status,
    })
    .returning();
  return row;
}

export async function checkAutoIntakeSuppressed(sessionId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: chatToolResults.id })
    .from(chatToolResults)
    .where(
      and(
        eq(chatToolResults.sessionId, sessionId),
        eq(chatToolResults.toolName, "auto_intake_suppressed"),
        eq(chatToolResults.status, "dismissed")
      )
    )
    .limit(1);
  return !!row;
}

export async function dismissPriorPendingToolResults(
  sessionId: string,
  toolName: string
): Promise<void> {
  await db
    .update(chatToolResults)
    .set({ status: "dismissed" })
    .where(
      and(
        eq(chatToolResults.sessionId, sessionId),
        eq(chatToolResults.toolName, toolName),
        eq(chatToolResults.status, "pending")
      )
    );
}

export async function updateToolResult(params: {
  toolResultId: string;
  sessionId: string;
  output?: unknown;
  status?: ChatToolResultStatus;
}) {
  const [row] = await db
    .update(chatToolResults)
    .set({
      ...(params.output !== undefined ? { output: params.output } : {}),
      ...(params.status ? { status: params.status } : {}),
    })
    .where(
      and(
        eq(chatToolResults.id, params.toolResultId),
        eq(chatToolResults.sessionId, params.sessionId)
      )
    )
    .returning();

  return row ?? null;
}

export async function getToolResultForSession(toolResultId: string, sessionId: string) {
  const [row] = await db
    .select()
    .from(chatToolResults)
    .where(
      and(eq(chatToolResults.id, toolResultId), eq(chatToolResults.sessionId, sessionId))
    )
    .limit(1);

  return row ?? null;
}

export async function loadPendingToolResults(sessionId: string) {
  return db
    .select()
    .from(chatToolResults)
    .where(
      and(eq(chatToolResults.sessionId, sessionId), eq(chatToolResults.status, "pending"))
    )
    .orderBy(asc(chatToolResults.createdAt));
}

export async function countConsecutiveToolErrors(sessionId: string): Promise<number> {
  const recent = await db
    .select({ status: chatToolResults.status })
    .from(chatToolResults)
    .where(eq(chatToolResults.sessionId, sessionId))
    .orderBy(desc(chatToolResults.createdAt))
    .limit(10);

  let streak = 0;
  for (const row of recent) {
    if (row.status === "error") {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}

export async function summarizeOverflowMessages(sessionId: string): Promise<void> {
  const total = await countSessionMessages(sessionId);
  if (total <= CHAT_MESSAGE_HISTORY_LIMIT) {
    return;
  }

  const overflowCount = total - CHAT_MESSAGE_HISTORY_LIMIT;
  const olderMessages = await db
    .select()
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.sessionId, sessionId),
        sql`${chatMessages.content} NOT LIKE ${`${SUMMARY_MARKER}%`}`
      )
    )
    .orderBy(asc(chatMessages.createdAt))
    .limit(overflowCount);

  if (olderMessages.length === 0) {
    return;
  }

  const transcript = olderMessages
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n");

  const { text: summary } = await generateText({
    model: openai(getChatModel()),
    system:
      "Summarize this chat history for context compression. Preserve decisions, tool outcomes, and consultation facts. Never include raw transcript text.",
    prompt: transcript,
  });

  await insertChatMessage({
    sessionId,
    role: "system",
    content: `${SUMMARY_MARKER} ${summary}`,
  });

  const idsToDelete = olderMessages.map((message) => message.id);
  await db.delete(chatMessages).where(inArray(chatMessages.id, idsToDelete));
}

export function toModelMessages(
  dbMessages: Awaited<ReturnType<typeof loadRecentChatMessages>>
): ModelMessage[] {
  return dbMessages
    .filter(
      (message): message is typeof message & { role: "user" | "assistant" | "system" } =>
        message.role === "user" || message.role === "assistant" || message.role === "system"
    )
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
}

export const REVERSIBLE_TOOLS = [
  "confirm_meeting",
  "confirm_themes",
  "edit_meeting",
  "edit_theme",
  "create_insight",
  "link_person_to_consultation",
] as const;

export async function getLastReversibleAction(sessionId: string) {
  const [row] = await db
    .select()
    .from(chatToolResults)
    .where(
      and(
        eq(chatToolResults.sessionId, sessionId),
        eq(chatToolResults.status, "success"),
        inArray(chatToolResults.toolName, [...REVERSIBLE_TOOLS])
      )
    )
    .orderBy(desc(chatToolResults.createdAt))
    .limit(1);

  return row ?? null;
}

const SESSION_MEMORY_CUTOFF_DAYS = 14;

export async function getPendingSessionItem(consultationId: string) {
  const cutoff = new Date(Date.now() - SESSION_MEMORY_CUTOFF_DAYS * 24 * 60 * 60 * 1000);

  const [row] = await db
    .select({
      id: chatToolResults.id,
      toolName: chatToolResults.toolName,
      input: chatToolResults.input,
      output: chatToolResults.output,
      createdAt: chatToolResults.createdAt,
      sessionId: chatToolResults.sessionId,
    })
    .from(chatToolResults)
    .innerJoin(chatSessions, eq(chatToolResults.sessionId, chatSessions.id))
    .where(
      and(
        eq(chatSessions.consultationId, consultationId),
        eq(chatToolResults.status, "pending"),
        gt(chatToolResults.createdAt, cutoff)
      )
    )
    .orderBy(desc(chatToolResults.createdAt))
    .limit(1);

  return row ?? null;
}
