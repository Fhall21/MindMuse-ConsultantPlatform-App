import {
  insertChatMessage,
  insertToolResult,
  updateChatMessageContent,
} from "./persist";
import { TURN_CARD_STACK_BLOCKED_MESSAGE, TurnCardGate } from "./turn-card-gate";
import type { ChatToolRuntimeContext } from "./tool-context";
import {
  CURRENT_MEETING_CONTEXT_TOOL,
  extractMeetingIdFromPayload,
  refreshCurrentMeetingContext,
} from "./current-meeting-context";

export async function persistToolExecution(params: {
  context: ChatToolRuntimeContext;
  toolName: string;
  input: Record<string, unknown>;
  output: unknown;
  status: "pending" | "success" | "error" | "dismissed";
}): Promise<{ id: string } | null> {
  const gate = params.context.turnCardGate ?? new TurnCardGate();
  const gateCheck = gate.assertCanShowCard(params.toolName);
  if (!gateCheck.ok) {
    return null;
  }

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

  gate.markCardShown(params.toolName);

  const meetingId =
    params.status !== "error" && params.status !== "dismissed"
      ? extractMeetingIdFromPayload(params.output) ?? extractMeetingIdFromPayload(params.input)
      : null;
  if (meetingId && params.toolName !== CURRENT_MEETING_CONTEXT_TOOL) {
    try {
      await refreshCurrentMeetingContext({
        userId: params.context.userId,
        sessionId: params.context.sessionId,
        meetingId,
        sourceToolName: params.toolName,
      });
    } catch (error) {
      console.error("[chat] failed to refresh current meeting context", error);
    }
  }

  return row;
}

export function requirePersistedToolResult(row: { id: string } | null): { id: string } {
  if (!row) {
    throw new Error(TURN_CARD_STACK_BLOCKED_MESSAGE);
  }
  return row;
}
