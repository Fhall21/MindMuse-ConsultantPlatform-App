import { AuditExportPanel } from "@/components/audit/audit-export-panel";

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Export compliance audit packages and generate reporting artifacts without burying them
          inside account settings.
        </p>
      </div>

      <AuditExportPanel />
    </div>
  );
}
