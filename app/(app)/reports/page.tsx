"use client";

import { AuditExportPanel } from "@/components/audit/audit-export-panel";
import { ReportList } from "@/components/reports/report-list";
import { ReportTemplatePanel } from "@/components/settings/report-template/report-template-panel";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Generated outputs and audit exports.
        </p>
      </div>

      <Tabs defaultValue="reports">
        <TabsList>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="custom-templates">Custom Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="reports" className="space-y-6">
          <ReportList />
          <AuditExportPanel />
        </TabsContent>

        <TabsContent value="custom-templates">
          <ReportTemplatePanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
