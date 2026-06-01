import type { ComponentType } from "react";
import { ClarificationQuestionCard } from "./ClarificationQuestionCard";
import { CreateProjectCard } from "./CreateProjectCard";
import { MeetingConfirmationCard } from "./MeetingConfirmationCard";
import { QuoteCard } from "./QuoteCard";
import { ThemeReviewCard } from "./ThemeReviewCard";
import { ToolResultFallbackCard } from "./ToolResultFallbackCard";
import type { ChatCardProps } from "./types";

export type ChatCardComponent = ComponentType<ChatCardProps>;

export const CHAT_CARD_MAP: Record<string, ChatCardComponent> = {
  intake_text_transcript: MeetingConfirmationCard,
  intake_audio_transcript: MeetingConfirmationCard,
  intake_notes: MeetingConfirmationCard,
  generate_clarification: ClarificationQuestionCard,
  extract_themes: ThemeReviewCard,
  identify_quotes: QuoteCard,
  create_project: CreateProjectCard,
};

export function resolveChatCard(toolName: string): ChatCardComponent {
  return CHAT_CARD_MAP[toolName] ?? ToolResultFallbackCard;
}

export {
  ClarificationQuestionCard,
  CreateProjectCard,
  MeetingConfirmationCard,
  QuoteCard,
  ThemeReviewCard,
  ToolResultFallbackCard,
};
export { ProjectSelectionCard } from "./ProjectSelectionCard";
export type { ChatCardProps } from "./types";
