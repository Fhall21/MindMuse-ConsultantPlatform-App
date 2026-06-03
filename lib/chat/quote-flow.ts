import { getUnarchivedSessionForUser } from "./context";
import { TURN_CARD_STACK_BLOCKED_MESSAGE } from "./turn-card-gate";
import { identifyAndPersistQuotes } from "./quotes-db";
import type { ChatToolRuntimeContext } from "./tool-context";
import { buildMeetingPickerOutput } from "./tools/meetings-picker";
import { getLatestMeetingActionSelection } from "./meeting-picker-session";
import {
  attachPendingActionToPickerOutput,
  meetingPendingActionSchema,
  type MeetingPendingAction,
} from "./meeting-pending-action";
import { inferQuotePendingAction } from "./quote-intent";
import { isMeetingActionContinuation } from "./tools/meeting-action";
import { resolveMeetingForConsultationAction } from "./meeting-resolve";
import {
  getMeetingForUser,
  listInsightsForMeeting,
  listMeetingsForConsultation,
} from "@/lib/data/domain-read";

async function persistQuoteMeetingPicker(params: {
  context: ChatToolRuntimeContext;
  consultationId: string;
  input: Record<string, unknown>;
  persist: (args: {
    context: ChatToolRuntimeContext;
    toolName: string;
    input: Record<string, unknown>;
    output: unknown;
    status: "pending" | "success" | "error" | "dismissed";
  }) => Promise<{ id: string } | null>;
}) {
  const meetings = await listMeetingsForConsultation(params.consultationId, params.context.userId);
  const basePicker = buildMeetingPickerOutput({
    consultationId: params.consultationId,
    meetings: meetings.map((m) => ({
      id: m.id,
      title: m.title,
      date: m.meeting_date ?? null,
    })),
  });
  const inferred = inferQuotePendingAction(params.context.latestUserMessage ?? "");
  const parsedPending = meetingPendingActionSchema.safeParse(params.input.pending_action);
  const pendingAction: MeetingPendingAction = parsedPending.success
    ? parsedPending.data
    : inferred;
  const pickerOutput = attachPendingActionToPickerOutput(basePicker, pendingAction);

  const toolResult = await params.persist({
    context: params.context,
    toolName: "select_meeting_for_action",
    input: { ...params.input, pending_action: pendingAction },
    output: pickerOutput,
    status: "pending",
  });

  if (!toolResult) {
    return { error: TURN_CARD_STACK_BLOCKED_MESSAGE };
  }

  return { ...pickerOutput, tool_result_id: toolResult.id };
}

export async function executeIdentifyQuotesTool(params: {
  context: ChatToolRuntimeContext;
  meetingId?: string;
  themeIds?: string[];
  userMessage?: string | null;
  persist: (args: {
    context: ChatToolRuntimeContext;
    toolName: string;
    input: Record<string, unknown>;
    output: unknown;
    status: "pending" | "success" | "error" | "dismissed";
  }) => Promise<{ id: string } | null>;
}) {
  const session = await getUnarchivedSessionForUser(
    params.context.userId,
    params.context.sessionId
  );
  const consultationId = session?.consultationId ?? null;
  let meetingId = params.meetingId;

  if (
    params.userMessage &&
    isMeetingActionContinuation(params.userMessage) &&
    !meetingId
  ) {
    const locked = await getLatestMeetingActionSelection(params.context.sessionId);
    if (locked) {
      meetingId = locked.meetingId;
    }
  }

  const skipPicker =
    Boolean(
      params.userMessage &&
        isMeetingActionContinuation(params.userMessage) &&
        meetingId
    );

  if (!meetingId && !skipPicker) {
    const resolved = await resolveMeetingForConsultationAction({
      userId: params.context.userId,
      consultationId,
      meetingId: undefined,
      userMessage: params.userMessage,
    });

    if (!resolved.ok) {
      const payload: Record<string, unknown> = {
        ...(params.themeIds ? { theme_ids: params.themeIds } : {}),
      };

      if (resolved.needsPicker && consultationId) {
        return persistQuoteMeetingPicker({
          context: params.context,
          consultationId,
          input: payload,
          persist: params.persist,
        });
      }

      const message = resolved.error ?? "Could not resolve meeting.";
      await params.persist({
        context: params.context,
        toolName: "identify_quotes",
        input: payload,
        output: { error: message },
        status: "error",
      });
      return { error: message };
    }

    meetingId = resolved.meetingId;
  }

  if (!meetingId) {
    const message = "Meeting is not locked in yet. Use the meeting picker first.";
    await params.persist({
      context: params.context,
      toolName: "identify_quotes",
      input: {},
      output: { error: message },
      status: "error",
    });
    return { error: message };
  }

  const payload: Record<string, unknown> = {
    meeting_id: meetingId,
    ...(params.themeIds ? { theme_ids: params.themeIds } : {}),
  };
  let themeIds = params.themeIds ?? [];
  if (themeIds.length === 0) {
    const acceptedInsights = await listInsightsForMeeting(meetingId, params.context.userId, {
      accepted: true,
    });
    themeIds = acceptedInsights.map((insight) => insight.id);
  }

  if (themeIds.length === 0) {
    const message = "No accepted insights on this meeting yet. Confirm themes before extracting quotes.";
    await params.persist({
      context: params.context,
      toolName: "identify_quotes",
      input: payload,
      output: { error: message },
      status: "error",
    });
    return { error: message };
  }

  const result = await identifyAndPersistQuotes({
    userId: params.context.userId,
    sessionId: params.context.sessionId,
    meetingId,
    themeIds,
  });

  if (!result.ok) {
    await params.persist({
      context: params.context,
      toolName: "identify_quotes",
      input: payload,
      output: { error: result.error },
      status: "error",
    });
    return { error: result.error };
  }

  const toolResult = await params.persist({
    context: params.context,
    toolName: "identify_quotes",
    input: { ...payload, meeting_id: meetingId, theme_ids: themeIds },
    output: result.output,
    status: "pending",
  });

  if (!toolResult) {
    return { error: TURN_CARD_STACK_BLOCKED_MESSAGE };
  }

  return { ...result.output, tool_result_id: toolResult.id };
}

export async function executeShowQuotesTool(params: {
  context: ChatToolRuntimeContext;
  meetingId?: string;
  consultationId?: string;
  userMessage?: string | null;
  persist: (args: {
    context: ChatToolRuntimeContext;
    toolName: string;
    input: Record<string, unknown>;
    output: unknown;
    status: "pending" | "success" | "error" | "dismissed";
  }) => Promise<{ id: string } | null>;
}) {
  const session = await getUnarchivedSessionForUser(
    params.context.userId,
    params.context.sessionId
  );
  const consultationId =
    params.consultationId ?? session?.consultationId ?? undefined;
  const payload: Record<string, unknown> = {
    ...(params.meetingId ? { meeting_id: params.meetingId } : {}),
    ...(consultationId ? { consultation_id: consultationId } : {}),
  };

  if (!consultationId) {
    return { error: "No consultation selected. Choose one first." };
  }

  const resolved = await resolveMeetingForConsultationAction({
    userId: params.context.userId,
    consultationId,
    meetingId: params.meetingId,
    userMessage: params.userMessage,
  });

  if (!resolved.ok) {
    if (resolved.needsPicker) {
      return persistQuoteMeetingPicker({
        context: params.context,
        consultationId,
        input: payload,
        persist: params.persist,
      });
    }

    await params.persist({
      context: params.context,
      toolName: "show_quotes",
      input: payload,
      output: { error: resolved.error ?? "Could not resolve meeting." },
      status: "error",
    });
    return { error: resolved.error ?? "Could not resolve meeting." };
  }

  const meeting = await getMeetingForUser(resolved.meetingId, params.context.userId);
  if (!meeting || meeting.consultation_id !== consultationId) {
    const message = "Meeting not found or access denied.";
    await params.persist({
      context: params.context,
      toolName: "show_quotes",
      input: payload,
      output: { error: message },
      status: "error",
    });
    return { error: message };
  }

  const output = {
    meeting_id: meeting.id,
    meeting_title: meeting.title,
  };

  const toolResult = await params.persist({
    context: params.context,
    toolName: "show_quotes",
    input: { ...payload, meeting_id: meeting.id },
    output,
    status: "pending",
  });

  if (!toolResult) {
    return { error: TURN_CARD_STACK_BLOCKED_MESSAGE };
  }

  return { ...output, tool_result_id: toolResult.id };
}
