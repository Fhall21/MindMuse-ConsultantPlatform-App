"use client";

import { AuditExportPanel } from "@/components/audit/audit-export-panel";
import { ReportList } from "@/components/reports/report-list";

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Generated outputs and audit exports.
        </p>
      </div>

      <ReportList />

      <AuditExportPanel />
    </div>
  );
}
