export type AuditExportFormat = "csv" | "json" | "pdf";

export interface AuditExportFilters {
  dateFrom?: string | null;
  dateTo?: string | null;
  consultationId?: string | null;
  userId?: string | null;
}

export interface AuditExportLifecycleMarker {
  action: string;
  label: string;
  timestamp: string;
  userId: string;
}

export interface AuditExportEvent {
  id: string;
  consultationId: string | null;
  timestamp: string;
  action: string;
  label: string;
  lifecycleStage: string;
  entityType: string | null;
  entityId: string | null;
  userId: string;
  payload: Record<string, unknown> | null;
}

export interface AuditExportArtifactSummary {
  themeCount: number;
  acceptedThemeCount: number;
  rejectedThemeCount: number;
  evidenceEmailCount: number;
  latestEvidenceEmailStatus: string | null;
  evidenceEmailGeneratedAt: string | null;
  evidenceEmailAcceptedAt: string | null;
  evidenceEmailSentAt: string | null;
}

export interface AuditExportConsultationRecord {
  consultationId: string | null;
  title: string;
  roundLabel: string | null;
  status: string | null;
  userId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  chronology: AuditExportEvent[];
  lifecycleMarkers: AuditExportLifecycleMarker[];
  artifactSummary: AuditExportArtifactSummary;
}

export interface AuditExportPackage {
  generatedAt: string;
  filenameBase: string;
  filters: Required<AuditExportFilters>;
  summary: {
    consultationCount: number;
    eventCount: number;
    userCount: number;
  };
  consultations: AuditExportConsultationRecord[];
}
