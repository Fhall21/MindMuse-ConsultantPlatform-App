/**
 * Round Detail contracts — shared types for the round workflow page.
 *
 * These types define the data shape that the round detail page consumes.
 * Agent 1 provides the DB schema and write actions; this file defines
 * the UI-facing contract that maps to those.
 */

// ─── Enums ───────────────────────────────────────────────────────────────────

export type RoundThemeGroupStatus =
  | "draft"
  | "accepted"
  | "discarded"
  | "management_rejected";

export type RoundThemeGroupOrigin = "manual" | "ai_refined";

export type RoundDecisionTargetType = "source_theme" | "theme_group";

export type RoundDecisionType =
  | "accept"
  | "discard"
  | "management_reject";

export type RoundOutputType = "summary" | "report" | "email";

export type RoundOutputStatus = "pending" | "generating" | "ready" | "failed";

// ─── Source Theme ────────────────────────────────────────────────────────────

export interface SourceTheme {
  id: string;
  sourceConsultationId: string;
  sourceConsultationTitle: string;
  sourceThemeId: string;
  label: string;
  description: string | null;
  editableLabel: string;
  editableDescription: string | null;
  accepted: boolean;
  lockedFromSource: boolean;
  isGrouped: boolean;
  isUserAdded: boolean;
  groupId: string | null;
}

// ─── Round Theme Group ───────────────────────────────────────────────────────

export interface RoundThemeGroup {
  id: string;
  label: string;
  description: string | null;
  status: RoundThemeGroupStatus;
  origin: RoundThemeGroupOrigin;
  members: SourceTheme[];
  pendingDraft: RoundThemeGroupDraft | null;
  lastStructuralChangeAt: string | null;
}

export interface RoundThemeGroupDraft {
  draftLabel: string;
  draftDescription: string | null;
  draftExplanation: string | null;
}

// ─── Decision History ────────────────────────────────────────────────────────

export interface RoundDecisionHistoryEntry {
  id: string;
  targetType: RoundDecisionTargetType;
  targetId: string;
  targetLabel: string;
  decisionType: RoundDecisionType;
  rationale: string | null;
  actor: string;
  timestamp: string;
}

// ─── Consultation summary for round context ──────────────────────────────────

export interface RoundConsultationSummary {
  id: string;
  title: string;
  status: string;
  evidenceEmailSubject: string | null;
  evidenceEmailStatus: string | null;
  themeCount: number;
}

// ─── Round Output ────────────────────────────────────────────────────────────

export interface RoundOutput {
  type: RoundOutputType;
  status: RoundOutputStatus;
  content: string | null;
  generatedAt: string | null;
  error: string | null;
}

// ─── Full Round Detail payload ───────────────────────────────────────────────

export interface RoundDetail {
  round: {
    id: string;
    label: string;
    description: string | null;
    linkedConsultationCount: number;
    createdAt: string;
  };
  consultations: RoundConsultationSummary[];
  sourceThemes: SourceTheme[];
  themeGroups: RoundThemeGroup[];
  decisionHistory: RoundDecisionHistoryEntry[];
  outputs: RoundOutput[];
}
