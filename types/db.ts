/**
 * Canonical type definitions for ConsultantPlatform
 * Re-exports from database.ts with enums for type-safe status fields
 * Used by all agents for consistent typing across hooks, actions, and components
 */

export type ConsultationStatus = "draft" | "complete";
export type EvidenceEmailStatus = "draft" | "accepted" | "sent";

export type {
  Consultation,
  ConsultationRound,
  Theme,
  ThemeDecisionLog,
  ThemeDecisionType,
  Person,
  ConsultationPerson,
  EvidenceEmail,
  AuditLogEntry,
  TranscriptionJob,
  OcrJob,
  IngestionArtifact,
  IngestionStatus,
  IngestionArtifactType,
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
