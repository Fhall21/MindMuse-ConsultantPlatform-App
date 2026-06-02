import { getUnarchivedSessionForUser } from "./context";
import { getToolResultForSession, insertChatMessage, updateToolResult } from "./persist";
import {
  getCardConfirmationMessage,
  type CardConfirmationAction,
} from "./card-confirmation-copy";

export async function insertOwnedCardConfirmation(params: {
  userId: string;
  sessionId: string | null | undefined;
  toolResultId?: string | null;
  action: CardConfirmationAction;
}): Promise<boolean> {
  if (!params.sessionId) {
    return false;
  }

  const session = await getUnarchivedSessionForUser(params.userId, params.sessionId);
  if (!session) {
    return false;
  }

  if (params.toolResultId) {
    const toolResult = await getToolResultForSession(params.toolResultId, session.id);
    if (!toolResult) {
      return false;
    }

    await updateToolResult({
      toolResultId: toolResult.id,
      sessionId: session.id,
      output: toolResult.output,
      status: "success",
    });
  }

  await insertChatMessage({
    sessionId: session.id,
    role: "assistant",
    content: getCardConfirmationMessage(params.action),
  });

  return true;
}
