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
  RoundThemeGroupDetail,
  RoundThemeGroupMemberDetail,
  RoundThemeGroupDraftState,
  RoundDecisionHistoryItem,
  RoundOutputSummary,
  RoundOutputCollection,
  RoundHistoryEvent,
  RoundAnalyticsSummary,
} from "@/lib/actions/round-workflow";

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

// Legacy type alias for backward compat with existing usage
export type RoundThemeGroup = RoundThemeGroupDetail;
export type RoundThemeGroupDraft = RoundThemeGroupDraftState;
export type RoundThemeGroupStatus = RoundThemeGroupDetail["status"];
export type RoundThemeGroupOrigin = RoundThemeGroupDetail["origin"];
export type RoundConsultationSummary = RoundDetailConsultation;
