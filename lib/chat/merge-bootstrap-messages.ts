import type { UIMessage } from "ai";
import { collapseDuplicateProse } from "@/lib/chat/dedupe-prose";

function getPlainAssistantText(message: UIMessage): string {
  const metadata = message.metadata as { chatTool?: unknown } | undefined;
  if (metadata?.chatTool) {
    return "";
  }
  const text = message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
  return collapseDuplicateProse(text);
}

function findLastStreamedAssistantProse(messages: UIMessage[]): UIMessage | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== "assistant") {
      continue;
    }
    if (getPlainAssistantText(message)) {
      return message;
    }
  }
  return null;
}

function bootstrapIncludesAssistantText(messages: UIMessage[], text: string): boolean {
  const normalized = collapseDuplicateProse(text);
  if (!normalized) {
    return false;
  }

  return messages.some((message) => {
    if (message.role !== "assistant") {
      return false;
    }
    const bootstrapText = getPlainAssistantText(message);
    return (
      bootstrapText === normalized ||
      bootstrapText.includes(normalized) ||
      normalized.includes(bootstrapText)
    );
  });
}

/** Keep streamed assistant prose when bootstrap reload races persistence. */
export function mergeBootstrapWithStreamingAssistant(
  streamingMessages: UIMessage[],
  bootstrapMessages: UIMessage[]
): UIMessage[] {
  const streamedAssistant = findLastStreamedAssistantProse(streamingMessages);
  if (!streamedAssistant) {
    return bootstrapMessages;
  }

  const streamedText = getPlainAssistantText(streamedAssistant);
  if (!streamedText || bootstrapIncludesAssistantText(bootstrapMessages, streamedText)) {
    return bootstrapMessages;
  }

  return [...bootstrapMessages, streamedAssistant];
}
