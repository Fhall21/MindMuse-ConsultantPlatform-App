/**
 * Consultation Detail type adapters.
 *
 * These types adapt Agent 1's server types into the UI-friendly shapes
 * that components expect. This provides a stable API even as the server
 * schema evolves.
 */

export type {
  RoundDetail as ConsultationDetail,
  RoundDetailConsultation as ConsultationDetailMeeting,
  RoundSourceTheme,
  ThemeDetail,
  ThemeMemberDetail,
  ThemeDraftState,
  RoundDecisionHistoryItem as ConsultationDecisionHistoryItem,
  RoundOutputSummary as ConsultationOutputSummary,
  RoundOutputCollection as ConsultationOutputCollection,
  RoundHistoryEvent as ConsultationHistoryEvent,
  RoundAnalyticsSummary as ConsultationAnalyticsSummary,
  ConsultationGroupDetail as MeetingGroupDetail,
  ConsultationGroupMemberDetail as MeetingGroupMemberDetail,
} from "@/lib/actions/consultation-workflow";

// Component-friendly aliases
export type { ThemeDetail as ConsultationThemeGroupDetail, ThemeMemberDetail as ConsultationThemeGroupMemberDetail, ThemeDraftState as ConsultationThemeGroupDraftState } from "@/lib/actions/consultation-workflow";

// Component-friendly adapter types that derive from Agent 1 types

export interface SourceTheme {
  id: string; // = sourceThemeId
  sourceMeetingId: string; // = meetingId
  sourceMeetingTitle: string; // = meetingTitle
  label: string;
  description: string | null;
  editableLabel: string;
  editableDescription: string | null;
  lockedFromSource: boolean;
  isGrouped: boolean;
  isUserAdded: boolean;
  groupId: string | null;
}

export interface ConsultationMeetingSummary {
  id: string;
  title: string;
  status: string;
  evidenceEmailSubject: string | null;
  evidenceEmailStatus: string | null;
  themeCount: number;
  groupId: string | null;
}

// New type aliases for insights/themes terminology
export type ThemeStatus = "draft" | "accepted" | "discarded" | "management_rejected";
export type ThemeOrigin = "manual" | "ai_refined";

// Legacy type aliases for backward compat with existing usage
export type { ThemeDetail as ConsultationThemeGroup, ThemeDraftState as ConsultationThemeGroupDraft } from "@/lib/actions/consultation-workflow";
export type ConsultationThemeGroupStatus = "draft" | "accepted" | "discarded" | "management_rejected";
export type ConsultationThemeGroupOrigin = "manual" | "ai_refined";
