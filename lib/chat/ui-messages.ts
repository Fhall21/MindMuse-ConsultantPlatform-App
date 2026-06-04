import type { UIMessage } from "ai";
import type { ChatMessageMetadata, ChatToolResultStatus } from "@/db/schema";
import { getSuggestedResponsesFromMetadata } from "@/lib/chat/suggested-responses";
import type { loadRecentChatMessages, loadToolResultsForSession } from "@/lib/chat/persist";

const SUMMARY_PREFIX = "[CHAT_HISTORY_SUMMARY]";

export interface ChatToolMessageMeta {
  toolName: string;
  input: Record<string, unknown>;
  output?: unknown;
  status?: ChatToolResultStatus;
  toolResultId?: string;
}

export function parseToolMessageContent(content: string): ChatToolMessageMeta | null {
  try {
    const parsed = JSON.parse(content) as {
      tool?: string;
      input?: Record<string, unknown>;
      output?: unknown;
      status?: ChatToolResultStatus;
      toolResultId?: string;
    };
    if (!parsed.tool) {
      return null;
    }
    return {
      toolName: parsed.tool,
      input: parsed.input ?? {},
      output: parsed.output,
      status: parsed.status,
      toolResultId: parsed.toolResultId,
    };
  } catch {
    return null;
  }
}

type DbMessage = Awaited<ReturnType<typeof loadRecentChatMessages>>[number];
type DbToolResult = Awaited<ReturnType<typeof loadToolResultsForSession>>[number];

export function dbMessagesToUiMessages(
  dbMessages: DbMessage[],
  toolResults: DbToolResult[] = []
): UIMessage[] {
  const toolResultsByMessageId = new Map(
    toolResults.map((result) => [result.messageId, result])
  );
  const uiMessages: UIMessage[] = [];

  for (const message of dbMessages) {
    if (message.role === "system" && message.content.startsWith(SUMMARY_PREFIX)) {
      continue;
    }

    if (message.role === "tool") {
      const toolMeta = parseToolMessageContent(message.content);
      if (!toolMeta) {
        continue;
      }

      const persisted = toolResultsByMessageId.get(message.id);
      if (persisted) {
        toolMeta.output = persisted.output ?? toolMeta.output;
        toolMeta.status = persisted.status;
        toolMeta.toolResultId = persisted.id;
      }

      uiMessages.push({
        id: message.id,
        role: "assistant",
        metadata: { chatTool: toolMeta },
        parts: [{ type: "text", text: "" }],
      });
      continue;
    }

    if (message.role !== "user" && message.role !== "assistant") {
      continue;
    }

    const suggestedResponses = getSuggestedResponsesFromMetadata(
      message.metadata as ChatMessageMetadata | null
    );
    uiMessages.push({
      id: message.id,
      role: message.role,
      parts: [{ type: "text", text: message.content }],
      ...(suggestedResponses
        ? {
            metadata: {
              suggestedResponses,
            } satisfies ChatMessageMetadata,
          }
        : {}),
    });
  }

  return uiMessages;
}
