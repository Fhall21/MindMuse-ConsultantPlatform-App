import { digitalInterviewResponses } from "@/db/schema";
import {
  DIGITAL_INTERVIEW_FRAMEWORK_LABELS,
  type DigitalInterviewFramework,
} from "@/lib/digital-interview-frameworks";

export { DIGITAL_INTERVIEW_FRAMEWORK_LABELS, type DigitalInterviewFramework };

export type DigitalInterviewConversationTurn = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  metadata?: {
    boundaryId?: string;
    boundaryLabel?: string;
    boundarySource?: "universal" | "recommended" | "custom";
    boundaryReason?: string;
  };
};

export function formatDigitalInterviewFramework(framework: DigitalInterviewFramework) {
  return DIGITAL_INTERVIEW_FRAMEWORK_LABELS[framework];
}

export function responseToTranscript(
  response: typeof digitalInterviewResponses.$inferSelect
): string {
  return response.conversationHistory
    .filter((message) => message.role === "user")
    .map((message) => message.content)
    .join("\n\n");
}
