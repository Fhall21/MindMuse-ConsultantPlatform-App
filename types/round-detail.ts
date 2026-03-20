/**
 * Round Detail type adapters.
 *
 * These types adapt Agent 1's server types into the UI-friendly shapes
 * that components expect. This provides a stable API even as the server
 * schema evolves.
 */

export type {
  RoundDetail,
  RoundDetailConsultation,
  RoundSourceTheme,
  ThemeDetail,
  ThemeMemberDetail,
  ThemeDraftState,
  RoundDecisionHistoryItem,
  RoundOutputSummary,
  RoundOutputCollection,
  RoundHistoryEvent,
  RoundAnalyticsSummary,
  ConsultationGroupDetail,
  ConsultationGroupMemberDetail,
} from "@/lib/actions/round-workflow";

// Component-friendly aliases
export type { ThemeDetail as RoundThemeGroupDetail, ThemeMemberDetail as RoundThemeGroupMemberDetail, ThemeDraftState as RoundThemeGroupDraftState } from "@/lib/actions/round-workflow";

// Component-friendly adapter types that derive from Agent 1 types

export interface SourceTheme {
  id: string; // = sourceThemeId
  sourceConsultationId: string; // = consultationId
  sourceConsultationTitle: string; // = consultationTitle
  label: string;
  description: string | null;
  editableLabel: string;
  editableDescription: string | null;
  lockedFromSource: boolean;
  isGrouped: boolean;
  isUserAdded: boolean;
  groupId: string | null;
}

export interface RoundConsultationSummary {
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
export type { ThemeDetail as RoundThemeGroup, ThemeDraftState as RoundThemeGroupDraft } from "@/lib/actions/round-workflow";
export type RoundThemeGroupStatus = "draft" | "accepted" | "discarded" | "management_rejected";
export type RoundThemeGroupOrigin = "manual" | "ai_refined";
