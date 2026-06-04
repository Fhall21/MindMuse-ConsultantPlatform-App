import type { ChatMessageMetadata } from "@/db/schema/chat";
import { sessionTurnIncludesCardTool } from "@/lib/chat/card-tools";
import { getWorkflowSuggestedResponsesForContent } from "@/lib/chat/suggested-response-templates";
import {
  buildChatMessageMetadata,
  getSuggestedResponsesFromMetadata,
  invitesReplyHeuristic,
  shouldDisplaySuggestedResponses,
  type SuggestedResponsesPayload,
} from "@/lib/chat/suggested-responses";
import {
  getChatMessageForSession,
  loadRecentChatMessages,
  updateChatMessageMetadata,
} from "@/lib/chat/persist";

type StoredMessage = Awaited<ReturnType<typeof loadRecentChatMessages>>[number];

function logSuggestedResponsesSkip(
  reason: string,
  meta: Record<string, string | boolean | undefined>
): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  console.debug("[suggested-responses]", reason, meta);
}

export async function getLatestAssistantMessage(
  sessionId: string
): Promise<StoredMessage | null> {
  const messages = await loadRecentChatMessages(sessionId, 30);
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === "assistant") {
      return message;
    }
  }
  return null;
}

export async function canGenerateSuggestedResponsesForTurn(params: {
  sessionId: string;
  assistantText: string;
  messagesAfterTurn?: StoredMessage[];
}): Promise<boolean> {
  const text = params.assistantText.trim();
  if (!text || !invitesReplyHeuristic(text)) {
    return false;
  }

  if (getWorkflowSuggestedResponsesForContent(text)) {
    return true;
  }

  const messages =
    params.messagesAfterTurn ?? (await loadRecentChatMessages(params.sessionId));
  if (await sessionTurnIncludesCardTool(messages)) {
    return false;
  }

  return true;
}

async function persistSuggestedResponsesIfDisplayable(
  messageId: string,
  payload: SuggestedResponsesPayload
): Promise<SuggestedResponsesPayload | null> {
  if (!shouldDisplaySuggestedResponses(payload)) {
    return null;
  }

  await updateChatMessageMetadata(messageId, buildChatMessageMetadata(payload));
  return getSuggestedResponsesFromMetadata(buildChatMessageMetadata(payload));
}

async function resolveWorkflowPayloadForAssistantText(
  assistantText: string
): Promise<SuggestedResponsesPayload | null> {
  const workflow = getWorkflowSuggestedResponsesForContent(assistantText);
  if (!workflow || !shouldDisplaySuggestedResponses(workflow)) {
    return null;
  }
  return workflow;
}

/** Persist workflow chips for known funnel follow-ups; generative chips come from main model emit tool. */
export async function ensureSuggestedResponsesForAssistantMessage(params: {
  sessionId: string;
  messageId: string;
  assistantText: string;
  messagesAfterTurn?: StoredMessage[];
}): Promise<SuggestedResponsesPayload | null> {
  const message = await getChatMessageForSession(params.messageId, params.sessionId);
  if (!message || message.role !== "assistant") {
    logSuggestedResponsesSkip("message_not_found", {
      sessionId: params.sessionId,
      messageId: params.messageId,
    });
    return null;
  }

  const cached = getSuggestedResponsesFromMetadata(
    message.metadata as ChatMessageMetadata | null
  );
  if (cached) {
    return cached;
  }

  const workflow = await resolveWorkflowPayloadForAssistantText(params.assistantText);
  if (!workflow) {
    logSuggestedResponsesSkip("no_workflow_template", {
      sessionId: params.sessionId,
      messageId: params.messageId,
    });
    return null;
  }

  const eligible = await canGenerateSuggestedResponsesForTurn({
    sessionId: params.sessionId,
    assistantText: params.assistantText,
    messagesAfterTurn: params.messagesAfterTurn,
  });
  if (!eligible) {
    logSuggestedResponsesSkip("ineligible_turn", {
      sessionId: params.sessionId,
      messageId: params.messageId,
    });
    return null;
  }

  return persistSuggestedResponsesIfDisplayable(params.messageId, workflow);
}

export async function tryGenerateAndPersistSuggestedResponses(params: {
  sessionId: string;
  messageId: string;
  assistantText: string;
  messagesAfterTurn?: StoredMessage[];
}): Promise<SuggestedResponsesPayload | null> {
  return ensureSuggestedResponsesForAssistantMessage(params);
}

export async function resolveSuggestedResponsesForMessage(
  sessionId: string,
  messageId: string
): Promise<{ messageId: string; suggestedResponses: SuggestedResponsesPayload | null }> {
  const message = await getChatMessageForSession(messageId, sessionId);
  if (!message || message.role !== "assistant") {
    return { messageId, suggestedResponses: null };
  }

  const cached = getSuggestedResponsesFromMetadata(
    message.metadata as ChatMessageMetadata | null
  );
  if (cached) {
    return { messageId: message.id, suggestedResponses: cached };
  }

  const workflow = await ensureSuggestedResponsesForAssistantMessage({
    sessionId,
    messageId: message.id,
    assistantText: message.content,
  });

  return { messageId: message.id, suggestedResponses: workflow };
}

export async function resolveSuggestedResponsesForSession(
  sessionId: string,
  anchorMessageId?: string | null
): Promise<{ messageId: string | null; suggestedResponses: SuggestedResponsesPayload | null }> {
  if (anchorMessageId) {
    const resolved = await resolveSuggestedResponsesForMessage(sessionId, anchorMessageId);
    return {
      messageId: resolved.messageId,
      suggestedResponses: resolved.suggestedResponses,
    };
  }

  const latestAssistant = await getLatestAssistantMessage(sessionId);
  if (!latestAssistant) {
    return { messageId: null, suggestedResponses: null };
  }

  const cached = getSuggestedResponsesFromMetadata(
    latestAssistant.metadata as ChatMessageMetadata | null
  );
  if (cached) {
    return { messageId: latestAssistant.id, suggestedResponses: cached };
  }

  const workflow = await ensureSuggestedResponsesForAssistantMessage({
    sessionId,
    messageId: latestAssistant.id,
    assistantText: latestAssistant.content,
  });

  return {
    messageId: latestAssistant.id,
    suggestedResponses: workflow,
  };
}
