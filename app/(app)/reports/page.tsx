"use client";

import { AuditExportsPanel } from "@/components/audit/audit-exports-panel";
import { ReportGenerationCard } from "@/components/reports/report-generation-card";
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
          <TabsTrigger value="audit-exports">Audit Exports</TabsTrigger>
        </TabsList>

        <TabsContent value="reports" className="space-y-6">
          <ReportGenerationCard />
          <ReportList />
        </TabsContent>

        <TabsContent value="audit-exports" className="space-y-6">
          <AuditExportsPanel />
        </TabsContent>

        <TabsContent value="custom-templates">
          <ReportTemplatePanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
