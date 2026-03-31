"use client";

import { AuditExportPanel } from "@/components/audit/audit-export-panel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function AuditExportsPanel() {
  return (
    <div className="space-y-6">
      <AuditExportPanel />

      <Card className="border-dashed bg-muted/20 shadow-none">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-lg font-semibold tracking-tight">
              Compliance Audit Export
            </CardTitle>
            <Badge variant="secondary">In development</Badge>
          </div>
          <CardDescription>
            A second export view is on the way for teams who need a broader compliance-focused
            download.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            This area is reserved for a future export that will complement Site Actions Audit
            Export with compliance-specific reporting.
          </p>
          <p>
            For now, the live export above is the one you can use today.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
