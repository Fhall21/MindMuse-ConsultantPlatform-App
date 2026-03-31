import type { ReportInputSnapshot } from "@/lib/report-graph";

export interface ThemeProvenanceContext {
  consultationId: string | null;
  consultationTitle: string | null;
  roundId: string | null;
  roundLabel: string | null;
  isUserAdded: boolean;
}

export interface ReportThemeReference {
  key: string;
  label: string;
  sourceKind: "consultation" | "round";
  decisionStatus: "accepted" | "rejected";
  rationale: string | null;
  provenance: ThemeProvenanceContext[];
}

export interface IncludedThemeSelection {
  label: string;
  sourceKinds: Array<"consultation" | "round">;
  provenance: ThemeProvenanceContext[];
}

export interface RoundSummaryData {
  roundId: string;
  roundLabel: string;
  roundDescription: string | null;
  linkedConsultationCount: number;
  acceptedThemes: ReportThemeReference[];
  rejectedThemes: ReportThemeReference[];
}

export interface ConsultationReportData {
  consultationId: string;
  consultationTitle: string;
  roundId: string | null;
  roundLabel: string | null;
  consultationThemes: ReportThemeReference[];
  roundThemes: ReportThemeReference[];
  rejectedThemes: ReportThemeReference[];
  includedThemes: IncludedThemeSelection[];
  roundSummary: RoundSummaryData | null;
}

export interface ReportArtifactListItem {
  id: string;
  artifactType: "summary" | "report" | "email";
  title: string | null;
  contentPreview: string;
  roundId: string;
  roundLabel: string;
  generatedAt: string;
  updatedAt: string;
}

export interface ConsultationMeta {
  id: string;
  title: string;
  date: string;
  people: string[];
  meetingTypeLabel: string | null;
  participantLabels: string[];
}

export interface AuditSummaryEvent {
  action: string;
  createdAt: string;
  entityType: string | null;
}

export interface ReportArtifactDetail {
  id: string;
  artifactType: "summary" | "report" | "email";
  title: string | null;
  content: string;
  roundId: string;
  roundLabel: string;
  roundDescription: string | null;
  generatedAt: string;
  updatedAt: string;
  inputSnapshot: ReportInputSnapshot;
  consultationTitles: string[];
  consultations: ConsultationMeta[];
  acceptedThemeCount: number;
  supportingThemeCount: number;
  versionNumber: number;
  totalVersions: number;
  auditSummary: AuditSummaryEvent[];
  draftThemeGroups: Array<{ id: string; label: string; description: string | null }>;
}