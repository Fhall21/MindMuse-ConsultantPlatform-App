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
            This tab will host the future compliance export once that workflow is ready.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Placeholder content only. The current live export lives above as Site Actions Audit
            Export.
          </p>
          <p>
            We will replace this card with the real compliance export when the backend payload is
            ready.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
