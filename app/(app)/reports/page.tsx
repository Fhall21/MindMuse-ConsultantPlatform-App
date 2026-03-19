"use client";

import { AuditExportPanel } from "@/components/audit/audit-export-panel";
import { ReportList } from "@/components/reports/report-list";

export default function ReportsPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          View generated board-pack reports, round summaries, and evidence emails.
          Export compliance audit packages below.
        </p>
      </div>

      <ReportList />

      <AuditExportPanel />
    </div>
  );
}
