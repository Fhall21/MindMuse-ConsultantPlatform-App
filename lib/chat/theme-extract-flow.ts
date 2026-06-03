import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { chatSessions } from "@/db/schema";
import { listMeetingsForConsultation } from "@/lib/data/domain-read";
import { getUnarchivedSessionForUser } from "./context";
import {
  insertChatMessage,
  insertToolResult,
  updateChatMessageContent,
  updateToolResult,
} from "./persist";
import { extractAndPersistThemes, loadMeetingTranscript } from "./themes-db";
import type { ChatToolRuntimeContext } from "./tools";
import { attachPendingActionToPickerOutput } from "./meeting-pending-action";
import {
  buildMeetingPickerOutput,
  type MeetingPickerItem,
} from "./tools/meetings-picker";
import type { ThemeReviewOutput } from "./tools/themes";
import {
  formatMeetingPickerToolReturn,
  formatThemeExtractionToolReturn,
} from "./theme-tool-returns";

async function persistChatToolResult(params: {
  context: ChatToolRuntimeContext;
  toolName: string;
  input: Record<string, unknown>;
  output: unknown;
  status: "pending" | "success" | "error" | "dismissed";
}) {
  const toolMessage = await insertChatMessage({
    sessionId: params.context.sessionId,
    role: "tool",
    content: JSON.stringify({
      tool: params.toolName,
      input: params.input,
    }),
    toolCallId: params.toolName,
  });

  const row = await insertToolResult({
    sessionId: params.context.sessionId,
    messageId: toolMessage.id,
    toolName: params.toolName,
    input: params.input,
    output: params.output,
    status: params.status,
  });

  await updateChatMessageContent(
    toolMessage.id,
    JSON.stringify({
      tool: params.toolName,
      input: params.input,
      output: params.output,
      status: params.status,
      toolResultId: row.id,
    })
  );

  return row;
}

function mapMeetingsForPicker(
  meetings: Awaited<ReturnType<typeof listMeetingsForConsultation>>
): MeetingPickerItem[] {
  return meetings.map((meeting) => ({
    id: meeting.id,
    title: meeting.title,
    date: meeting.meeting_date ?? null,
  }));
}

export async function bindChatSessionConsultation(params: {
  userId: string;
  sessionId: string;
  consultationId: string;
}): Promise<void> {
  await db
    .update(chatSessions)
    .set({ consultationId: params.consultationId, updatedAt: new Date() })
    .where(
      and(
        eq(chatSessions.id, params.sessionId),
        eq(chatSessions.userId, params.userId),
        isNull(chatSessions.archivedAt)
      )
    );
}

export async function resolveMeetingIdForThemeExtraction(params: {
  userId: string;
  meetingId: string;
  consultationId: string | null;
}): Promise<
  | { ok: true; meetingId: string }
  | { ok: false; error: string; needsPicker: boolean }
> {
  const direct = await loadMeetingTranscript(params.userId, params.meetingId);
  if (direct.ok) {
    return { ok: true, meetingId: params.meetingId };
  }

  if (!params.consultationId) {
    return {
      ok: false,
      error:
        "No consultation is scoped to this chat. Choose a consultation, then use the meeting picker.",
      needsPicker: true,
    };
  }

  const meetings = await listMeetingsForConsultation(params.consultationId, params.userId);
  if (meetings.length === 1) {
    return { ok: true, meetingId: meetings[0].id };
  }

  if (meetings.length > 1) {
    return {
      ok: false,
      error:
        "Multiple meetings match this consultation. Use select_meeting_for_themes to show the meeting picker.",
      needsPicker: true,
    };
  }

  return {
    ok: false,
    error: "No meetings found for this consultation.",
    needsPicker: false,
  };
}

export async function persistExtractThemesToolResult(params: {
  context: ChatToolRuntimeContext;
  meetingId: string;
  input: Record<string, unknown>;
  output: ThemeReviewOutput;
}) {
  return persistChatToolResult({
    context: params.context,
    toolName: "extract_themes",
    input: params.input,
    output: params.output,
    status: "pending",
  });
}

export async function runThemeExtractionForMeeting(params: {
  context: ChatToolRuntimeContext;
  meetingId: string;
  input?: Record<string, unknown>;
}) {
  const payload = params.input ?? { meeting_id: params.meetingId };
  const result = await extractAndPersistThemes({
    userId: params.context.userId,
    sessionId: params.context.sessionId,
    meetingId: params.meetingId,
  });

  if (!result.ok) {
    await persistChatToolResult({
      context: params.context,
      toolName: "extract_themes",
      input: payload,
      output: { error: result.error },
      status: "error",
    });
    return { ok: false as const, error: result.error };
  }

  const toolResult = await persistExtractThemesToolResult({
    context: params.context,
    meetingId: params.meetingId,
    input: payload,
    output: result.output,
  });

  return {
    ok: true as const,
    output: result.output,
    toolResultId: toolResult.id,
  };
}

export async function executeSelectMeetingForThemesTool(params: {
  context: ChatToolRuntimeContext;
  consultationId?: string;
}) {
  const session = await getUnarchivedSessionForUser(
    params.context.userId,
    params.context.sessionId
  );
  const consultationId = params.consultationId ?? session?.consultationId ?? undefined;

  if (!consultationId) {
    return {
      ok: false as const,
      error: "No consultation is selected. Ask the user to choose a consultation first.",
    };
  }

  const meetings = await listMeetingsForConsultation(consultationId, params.context.userId);
  if (meetings.length === 0) {
    return {
      ok: false as const,
      error: "No meetings in this consultation yet. Confirm a meeting before extracting themes.",
    };
  }

  if (meetings.length === 1) {
    return runThemeExtractionForMeeting({
      context: params.context,
      meetingId: meetings[0].id,
      input: { meeting_id: meetings[0].id, consultation_id: consultationId },
    });
  }

  const pickerMeetings = mapMeetingsForPicker(meetings);
  const basePicker = buildMeetingPickerOutput({
    consultationId,
    meetings: pickerMeetings,
  });
  const output = attachPendingActionToPickerOutput(basePicker, "extract_themes");

  const toolResult = await persistChatToolResult({
    context: params.context,
    toolName: "select_meeting_for_themes",
    input: { consultation_id: consultationId, pending_action: "extract_themes" },
    output,
    status: "pending",
  });

  return {
    ok: true as const,
    picker: true as const,
    output,
    toolResultId: toolResult.id,
  };
}

export async function extractThemesFromPickerCard(params: {
  userId: string;
  sessionId: string;
  meetingId: string;
  pickerToolResultId?: string;
}) {
  const session = await getUnarchivedSessionForUser(params.userId, params.sessionId);
  if (!session) {
    return { ok: false as const, error: "Chat session not found" };
  }

  const context: ChatToolRuntimeContext = {
    userId: params.userId,
    sessionId: params.sessionId,
  };

  if (params.pickerToolResultId) {
    await updateToolResult({
      toolResultId: params.pickerToolResultId,
      sessionId: params.sessionId,
      status: "success",
    });
  }

  return runThemeExtractionForMeeting({
    context,
    meetingId: params.meetingId,
    input: { meeting_id: params.meetingId },
  });
}

export async function executeExtractThemesTool(params: {
  context: ChatToolRuntimeContext;
  meetingId?: string;
}) {
  const session = await getUnarchivedSessionForUser(
    params.context.userId,
    params.context.sessionId
  );
  const consultationId = session?.consultationId ?? null;
  const payload: Record<string, unknown> = params.meetingId
    ? { meeting_id: params.meetingId }
    : {};

  if (params.meetingId) {
    const resolved = await resolveMeetingIdForThemeExtraction({
      userId: params.context.userId,
      meetingId: params.meetingId,
      consultationId,
    });

    if (resolved.ok) {
      return formatThemeExtractionToolReturn(
        await runThemeExtractionForMeeting({
          context: params.context,
          meetingId: resolved.meetingId,
          input: payload,
        })
      );
    }

    if (resolved.needsPicker) {
      return formatMeetingPickerToolReturn(
        await executeSelectMeetingForThemesTool({
          context: params.context,
          consultationId: consultationId ?? undefined,
        })
      );
    }

    await persistChatToolResult({
      context: params.context,
      toolName: "extract_themes",
      input: payload,
      output: { error: resolved.error },
      status: "error",
    });
    return { error: resolved.error };
  }

  return formatMeetingPickerToolReturn(
    await executeSelectMeetingForThemesTool({
      context: params.context,
      consultationId: consultationId ?? undefined,
    })
  );
}
