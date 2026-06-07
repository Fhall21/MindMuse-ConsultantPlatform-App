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
// Sprint 22 Task 01
import { MeetingActionPickerCard } from "./MeetingActionPickerCard";
import { PersonLinkCard } from "./PersonLinkCard";
import { InsightCreateCard } from "./InsightCreateCard";
import { ReportSummaryCard } from "./ReportSummaryCard";
import { MeetingEditCard } from "./MeetingEditCard";
import { ThemeEditCard } from "./ThemeEditCard";
import { AuditTrailCard } from "./AuditTrailCard";
import { ReportExportCard } from "./ReportExportCard";
// Sprint 22 Task 04
import { CanvasOperationCard } from "./CanvasOperationCard";
import { LiteratureReviewStartCard } from "./LiteratureReviewStartCard";
import { PersonUnlinkCard } from "./PersonUnlinkCard";
import { BulkDismissPendingCard } from "./BulkDismissPendingCard";
import { MeetingNoteCard } from "./MeetingNoteCard";
import { AskChoiceCard } from "./AskChoiceCard";
import { QuoteReviewCard } from "./QuoteReviewCard";
// Sprint 25 task-09b — cross-meeting analysis
import { AnalyzeStartCard } from "./AnalyzeStartCard";
import { PreviousAnalysesCard } from "./PreviousAnalysesCard";
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
  link_insights_to_group: ThemeGroupingCard,
  preview_canvas: CanvasPreviewCard,
  generate_research_questions: ResearchQuestionCard,
  draft_evidence_email: DraftPreviewCard,
  generate_report: ReportPreviewCard,
  link_research_to_themes: ResearchThemeLinkCard,
  create_project: CreateProjectCard,
  // Sprint 22 Task 01
  select_meeting_for_action: MeetingActionPickerCard,
  link_person_to_consultation: PersonLinkCard,
  create_insight: InsightCreateCard,
  show_report: ReportSummaryCard,
  edit_meeting: MeetingEditCard,
  edit_theme: ThemeEditCard,
  show_audit_trail: AuditTrailCard,
  export_report: ReportExportCard,
  // Sprint 22 Task 04
  manipulate_canvas: CanvasOperationCard,
  prepare_literature_review: LiteratureReviewStartCard,
  attach_meeting_note: MeetingNoteCard,
  unlink_person_from_meeting: PersonUnlinkCard,
  bulk_dismiss_pending: BulkDismissPendingCard,
  ask_user_choice: AskChoiceCard,
  // Sprint 22 — quote review in chat
  show_quotes: QuoteReviewCard,
  // Sprint 25 task-09b — cross-meeting analysis
  start_cross_analysis: AnalyzeStartCard,
  list_previous_analyses: PreviousAnalysesCard,
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
  QuoteReviewCard,
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
