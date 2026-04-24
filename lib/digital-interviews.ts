import { digitalInterviewResponses } from "@/db/schema";

export type DigitalInterviewFramework =
  | "appreciative_inquiry"
  | "psychological_safety"
  | "custom";

export const DIGITAL_INTERVIEW_FRAMEWORK_LABELS: Record<DigitalInterviewFramework, string> = {
  appreciative_inquiry: "Appreciative Inquiry",
  psychological_safety: "Psychological Safety",
  custom: "Custom",
};

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
