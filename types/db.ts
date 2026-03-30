/**
 * Canonical type definitions for ConsultantPlatform
 * Re-exports from database.ts with enums for type-safe status fields
 * Used by all agents for consistent typing across hooks, actions, and components
 */

export type ConsultationStatus = "draft" | "complete";
export type EvidenceEmailStatus = "draft" | "accepted" | "sent";
export type ThemeStatus =
  | "draft"
  | "accepted"
  | "discarded"
  | "management_rejected";
export type ThemeOrigin = "manual" | "ai_refined";
export type RoundDecisionTargetType =
  | "source_theme"
  | "theme_group"
  | "round_output";
export type RoundDecisionType =
  | "accepted"
  | "discarded"
  | "management_rejected";
export type RoundOutputArtifactType = "summary" | "report" | "email";
export type RoundOutputArtifactStatus = "generated";
export type ReportTemplatePrescriptiveness = "flexible" | "moderate" | "strict";

export type {
  AIInsightLearning,
  AIInsightLearningSupportingMetrics,
  AILearningTopicType,
  AILearningType,
  Consultation,
  Meeting,
  Meeting as ConsultationRound,
  Theme,
  ThemeMember,
  ConsultationDecision as RoundDecision,
  ConsultationOutputArtifact as RoundOutputArtifact,
  Insight,
  InsightDecisionLog,
  InsightDecisionType,
  Person,
  MeetingPerson as ConsultationPerson,
  EvidenceEmail,
  AuditLogEntry,
  ReportTemplate,
  ReportTemplateSection,
  ReportTemplateStyleNotes,
  BuilderConfig,
  BuilderSectionConfig,
  CustomSectionDef,
  TranscriptionJob,
  OcrJob,
  IngestionArtifact,
  IngestionStatus,
  IngestionArtifactType,
  UserAIPreferences,
  MeetingType,
} from "./database";
export type {
  AuditExportArtifactSummary,
  AuditExportConsultationRecord,
  AuditExportEvent,
  AuditExportFilters,
  AuditExportFormat,
  AuditExportLifecycleMarker,
  AuditExportPackage,
} from "./audit-export";

export type { ConsultationFormData, ThemeFormData, PersonFormData, EvidenceEmailFormData } from "@/lib/validations/consultation";
