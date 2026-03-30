export interface ReportShareLinkListItem {
  id: string;
  consultantName: string | null;
  consultantEmail: string;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
  viewCount: number;
  shareUrl: string;
  status: "active" | "expired" | "revoked";
}

export interface UserReportShareSettingsState {
  hasPasscode: boolean;
  passcodeUpdatedAt: string | null;
}

export interface PublicReportShareMetadata {
  consultantName: string | null;
  consultantEmailHint: string;
  reportTitle: string | null;
  expiresAt: string;
  requiresPasscode: true;
}