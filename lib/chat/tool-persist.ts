import {
  insertChatMessage,
  insertToolResult,
  updateChatMessageContent,
} from "./persist";
import { TURN_CARD_STACK_BLOCKED_MESSAGE, TurnCardGate } from "./turn-card-gate";
import type { ChatToolRuntimeContext } from "./tool-context";

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

  return row;
}

export function requirePersistedToolResult(row: { id: string } | null): { id: string } {
  if (!row) {
    throw new Error(TURN_CARD_STACK_BLOCKED_MESSAGE);
  }
  return row;
}
