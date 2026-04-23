import { digitalInterviewResponses } from "@/db/schema";

export type DigitalInterviewConversationTurn = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

export function responseToTranscript(
  response: typeof digitalInterviewResponses.$inferSelect
): string {
  return response.conversationHistory
    .filter((message) => message.role === "user")
    .map((message) => message.content)
    .join("\n\n");
}