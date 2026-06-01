import type { ComponentType } from "react";
import { ClarificationQuestionCard } from "./ClarificationQuestionCard";
import { CreateProjectCard } from "./CreateProjectCard";
import { CanvasPreviewCard } from "./CanvasPreviewCard";
import { DraftPreviewCard } from "./DraftPreviewCard";
import { MeetingConfirmationCard } from "./MeetingConfirmationCard";
import { MeetingPickerCard } from "./MeetingPickerCard";
import { QuoteCard } from "./QuoteCard";
import { ReportPreviewCard } from "./ReportPreviewCard";
import { ResearchQuestionCard } from "./ResearchQuestionCard";
import { ResearchThemeLinkCard } from "./ResearchThemeLinkCard";
import { ThemeGroupingCard } from "./ThemeGroupingCard";
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
  select_meeting_for_themes: MeetingPickerCard,
  identify_quotes: QuoteCard,
  group_themes: ThemeGroupingCard,
  preview_canvas: CanvasPreviewCard,
  generate_research_questions: ResearchQuestionCard,
  draft_evidence_email: DraftPreviewCard,
  generate_report: ReportPreviewCard,
  link_research_to_themes: ResearchThemeLinkCard,
  create_project: CreateProjectCard,
};

export function resolveChatCard(toolName: string): ChatCardComponent {
  return CHAT_CARD_MAP[toolName] ?? ToolResultFallbackCard;
}

export {
  CanvasPreviewCard,
  ClarificationQuestionCard,
  CreateProjectCard,
  DraftPreviewCard,
  MeetingConfirmationCard,
  MeetingPickerCard,
  QuoteCard,
  ReportPreviewCard,
  ResearchQuestionCard,
  ResearchThemeLinkCard,
  ThemeGroupingCard,
  ThemeReviewCard,
  ToolResultFallbackCard,
};
export { ProjectSelectionCard } from "./ProjectSelectionCard";
export { CHAT_CARD_TOOL_NAMES, isChatCardToolName } from "@/lib/chat/card-tools";
export type { ChatCardProps } from "./types";
