import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { meetingPeople, people } from "@/db/schema";
import {
  executeDraftEvidenceEmail,
} from "./async-actions-db";
import { getUnarchivedSessionForUser } from "./context";
import { findPriorUserRequestMessage } from "./meeting-picker-session";
import {
  inferMeetingPendingAction,
  readMeetingActionParams,
  readMeetingPendingAction,
  type MeetingPendingAction,
} from "./meeting-pending-action";
import { loadToolResultsForSession } from "./persist";
import { executeIdentifyQuotesTool, executeShowQuotesTool } from "./quote-flow";
import { extractThemesFromPickerCard } from "./theme-extract-flow";
import { persistToolExecution } from "./tool-persist";
import type { ChatToolRuntimeContext } from "./tool-context";
import { TurnCardGate } from "./turn-card-gate";
import {
  getMeetingForUser,
  listPeopleForUser,
} from "@/lib/data/domain-read";
import { readMeetingPickerOutput } from "./tools/meetings-picker";

export type MeetingPickerContinueResult =
  | { ok: true; action: MeetingPendingAction; toolResultId: string }
  | { ok: true; action: "chat_continue"; reason?: string }
  | { ok: false; error: string };

function toolResultIdFromReturn(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const id = (value as { tool_result_id?: unknown }).tool_result_id;
  return typeof id === "string" ? id : null;
}

function errorFromReturn(value: unknown, fallback: string): string | null {
  if (!value || typeof value !== "object" || !("error" in value)) {
    return null;
  }
  const message = (value as { error?: unknown }).error;
  return typeof message === "string" ? message : fallback;
}

async function resolvePendingActionForContinue(params: {
  sessionId: string;
  pickerToolResultId?: string;
}): Promise<{
  pendingAction: MeetingPendingAction;
  actionParams: Record<string, unknown>;
  consultationId: string | null;
} | null> {
  if (params.pickerToolResultId) {
    const results = await loadToolResultsForSession(params.sessionId);
    const row = results.find((item) => item.id === params.pickerToolResultId);
    if (row) {
      const picker = readMeetingPickerOutput(row.output);
      const pendingAction =
        readMeetingPendingAction({
          output: row.output,
          input: row.input,
          pickerToolName: row.toolName,
        }) ?? inferMeetingPendingAction((await findPriorUserRequestMessage(params.sessionId)) ?? "");

      if (pendingAction) {
        return {
          pendingAction,
          actionParams: readMeetingActionParams(row.input),
          consultationId: picker?.consultation_id ?? null,
        };
      }
    }
  }

  const priorUser = await findPriorUserRequestMessage(params.sessionId);
  const inferred = priorUser ? inferMeetingPendingAction(priorUser) : null;
  if (!inferred) {
    return null;
  }

  return {
    pendingAction: inferred,
    actionParams: {},
    consultationId: null,
  };
}

async function runCreateInsightCard(params: {
  context: ChatToolRuntimeContext;
  meetingId: string;
  actionParams: Record<string, unknown>;
}) {
  const labelHint =
    typeof params.actionParams.label_hint === "string" ? params.actionParams.label_hint : "";
  const output = { meeting_id: params.meetingId, label_hint: labelHint };
  const row = await persistToolExecution({
    context: params.context,
    toolName: "create_insight",
    input: { meeting_id: params.meetingId, label_hint: labelHint },
    output,
    status: "pending",
  });
  if (!row) {
    return { ok: false as const, error: "Could not open the insight card." };
  }
  return { ok: true as const, toolResultId: row.id };
}

async function runLinkPersonCard(params: {
  context: ChatToolRuntimeContext;
  meetingId: string;
  actionParams: Record<string, unknown>;
}) {
  const allPeople = await listPeopleForUser(params.context.userId);
  const personNameHint =
    typeof params.actionParams.person_name_hint === "string"
      ? params.actionParams.person_name_hint
      : null;
  const output = {
    meeting_id: params.meetingId,
    people: allPeople.map((person) => ({ id: person.id, name: person.name })),
    person_name_hint: personNameHint,
  };
  const row = await persistToolExecution({
    context: params.context,
    toolName: "link_person_to_consultation",
    input: {
      meeting_id: params.meetingId,
      person_name_hint: personNameHint ?? undefined,
    },
    output,
    status: "pending",
  });
  if (!row) {
    return { ok: false as const, error: "Could not open the person link card." };
  }
  return { ok: true as const, toolResultId: row.id };
}

async function runEditMeetingCard(params: {
  context: ChatToolRuntimeContext;
  meetingId: string;
  actionParams: Record<string, unknown>;
}) {
  const meeting = await getMeetingForUser(params.meetingId, params.context.userId);
  if (!meeting) {
    return { ok: false as const, error: "Meeting not found." };
  }
  const output = {
    meeting_id: meeting.id,
    title: meeting.title,
    meeting_date: meeting.meeting_date ?? null,
    meeting_type_id: meeting.meeting_type_id ?? null,
    title_hint:
      typeof params.actionParams.title_hint === "string"
        ? params.actionParams.title_hint
        : null,
    date_hint:
      typeof params.actionParams.date_hint === "string" ? params.actionParams.date_hint : null,
  };
  const row = await persistToolExecution({
    context: params.context,
    toolName: "edit_meeting",
    input: {
      meeting_id: params.meetingId,
      title_hint: output.title_hint ?? undefined,
      date_hint: output.date_hint ?? undefined,
    },
    output,
    status: "pending",
  });
  if (!row) {
    return { ok: false as const, error: "Could not open the meeting edit card." };
  }
  return { ok: true as const, toolResultId: row.id };
}

async function runUnlinkPersonCard(params: {
  context: ChatToolRuntimeContext;
  meetingId: string;
  actionParams: Record<string, unknown>;
}) {
  const meeting = await getMeetingForUser(params.meetingId, params.context.userId);
  if (!meeting) {
    return { ok: false as const, error: "Meeting not found." };
  }
  const linkedPeople = await db
    .select({ id: people.id, name: people.name })
    .from(meetingPeople)
    .innerJoin(people, eq(people.id, meetingPeople.personId))
    .where(
      and(eq(meetingPeople.meetingId, params.meetingId), eq(people.userId, params.context.userId))
    );
  const personNameHint =
    typeof params.actionParams.person_name_hint === "string"
      ? params.actionParams.person_name_hint
      : undefined;
  const output = {
    meeting_id: params.meetingId,
    meeting_title: meeting.title,
    person_name_hint: personNameHint,
    people: linkedPeople,
  };
  const row = await persistToolExecution({
    context: params.context,
    toolName: "unlink_person_from_meeting",
    input: { meeting_id: params.meetingId, person_name_hint: personNameHint },
    output,
    status: "pending",
  });
  if (!row) {
    return { ok: false as const, error: "Could not open the unlink card." };
  }
  return { ok: true as const, toolResultId: row.id };
}

async function runDraftEvidenceEmail(params: {
  context: ChatToolRuntimeContext;
  meetingId: string;
  consultationId: string;
}) {
  const result = await executeDraftEvidenceEmail({
    userId: params.context.userId,
    sessionId: params.context.sessionId,
    consultationId: params.consultationId,
    meetingIds: [params.meetingId],
  });

  if (!result.ok) {
    return { ok: false as const, error: result.error };
  }

  const row = await persistToolExecution({
    context: params.context,
    toolName: "draft_evidence_email",
    input: {
      consultation_id: params.consultationId,
      meeting_ids: [params.meetingId],
    },
    output: result.output,
    status: "pending",
  });

  if (!row) {
    return { ok: false as const, error: "Could not open the evidence email card." };
  }
  return { ok: true as const, toolResultId: row.id };
}

export async function runMeetingPickerContinue(params: {
  userId: string;
  sessionId: string;
  meetingId: string;
  pickerToolResultId?: string;
}): Promise<MeetingPickerContinueResult> {
  const session = await getUnarchivedSessionForUser(params.userId, params.sessionId);
  if (!session) {
    return { ok: false, error: "Chat session not found." };
  }

  const resolved = await resolvePendingActionForContinue({
    sessionId: params.sessionId,
    pickerToolResultId: params.pickerToolResultId,
  });

  if (!resolved) {
    return {
      ok: true,
      action: "chat_continue",
      reason: "Could not determine the next step after meeting selection.",
    };
  }

  const priorUser = await findPriorUserRequestMessage(params.sessionId);
  const context: ChatToolRuntimeContext = {
    userId: params.userId,
    sessionId: params.sessionId,
    turnCardGate: new TurnCardGate(),
    latestUserMessage: priorUser,
  };

  const consultationId =
    resolved.consultationId ?? session.consultationId ?? null;

  switch (resolved.pendingAction) {
    case "identify_quotes": {
      const result = await executeIdentifyQuotesTool({
        context,
        meetingId: params.meetingId,
        userMessage: priorUser,
        persist: persistToolExecution,
      });
      const error = errorFromReturn(result, "Could not extract quotes for that meeting.");
      if (error) {
        return { ok: false, error };
      }
      const toolResultId = toolResultIdFromReturn(result);
      if (!toolResultId) {
        return { ok: false, error: "Quote extraction did not start." };
      }
      return { ok: true, action: "identify_quotes", toolResultId };
    }

    case "show_quotes": {
      const result = await executeShowQuotesTool({
        context,
        meetingId: params.meetingId,
        consultationId: consultationId ?? undefined,
        userMessage: priorUser,
        persist: persistToolExecution,
      });
      const error = errorFromReturn(result, "Could not open quote review.");
      if (error) {
        return { ok: false, error };
      }
      const toolResultId = toolResultIdFromReturn(result);
      if (!toolResultId) {
        return { ok: false, error: "Quote review did not open." };
      }
      return { ok: true, action: "show_quotes", toolResultId };
    }

    case "extract_themes": {
      const result = await extractThemesFromPickerCard({
        userId: params.userId,
        sessionId: params.sessionId,
        meetingId: params.meetingId,
        pickerToolResultId: params.pickerToolResultId,
      });
      if (!result.ok) {
        return { ok: false, error: result.error };
      }
      return { ok: true, action: "extract_themes", toolResultId: result.toolResultId };
    }

    case "draft_evidence_email": {
      if (!consultationId) {
        return { ok: false, error: "Choose a consultation before drafting an evidence email." };
      }
      const result = await runDraftEvidenceEmail({
        context,
        meetingId: params.meetingId,
        consultationId,
      });
      if (!result.ok) {
        return { ok: false, error: result.error };
      }
      return { ok: true, action: "draft_evidence_email", toolResultId: result.toolResultId };
    }

    case "create_insight": {
      const result = await runCreateInsightCard({
        context,
        meetingId: params.meetingId,
        actionParams: resolved.actionParams,
      });
      if (!result.ok) {
        return { ok: false, error: result.error };
      }
      return { ok: true, action: "create_insight", toolResultId: result.toolResultId };
    }

    case "link_person_to_consultation": {
      const result = await runLinkPersonCard({
        context,
        meetingId: params.meetingId,
        actionParams: resolved.actionParams,
      });
      if (!result.ok) {
        return { ok: false, error: result.error };
      }
      return { ok: true, action: "link_person_to_consultation", toolResultId: result.toolResultId };
    }

    case "edit_meeting": {
      const result = await runEditMeetingCard({
        context,
        meetingId: params.meetingId,
        actionParams: resolved.actionParams,
      });
      if (!result.ok) {
        return { ok: false, error: result.error };
      }
      return { ok: true, action: "edit_meeting", toolResultId: result.toolResultId };
    }

    case "unlink_person_from_meeting": {
      const result = await runUnlinkPersonCard({
        context,
        meetingId: params.meetingId,
        actionParams: resolved.actionParams,
      });
      if (!result.ok) {
        return { ok: false, error: result.error };
      }
      return {
        ok: true,
        action: "unlink_person_from_meeting",
        toolResultId: result.toolResultId,
      };
    }

    default:
      return { ok: true, action: "chat_continue" };
  }
}
