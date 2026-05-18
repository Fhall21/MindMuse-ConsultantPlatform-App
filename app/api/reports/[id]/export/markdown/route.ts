export const runtime = "nodejs";

import { getReportArtifact } from "@/lib/actions/reports";
import { loadUserAIPreferences } from "@/lib/data/user-ai-preferences";
import {
  applyReferencesToSections,
  buildExportSections,
  type ReportTemplate,
} from "@/lib/report-export-content";
import { serializeToMarkdown } from "@/lib/report-export-markdown";
import { applyRenderPolicyToReport } from "@/lib/report-render-policy";
import { loadReportReferences } from "@/lib/report-references";
import { requireCurrentUserId } from "@/lib/data/auth-context";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const templateParam = req.nextUrl.searchParams.get("template");
  const template: ReportTemplate = templateParam === "executive" ? "executive" : "standard";

  const report = await getReportArtifact(id);
  const preferences = await loadUserAIPreferences();

  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  const renderedReport = applyRenderPolicyToReport(
    report,
    preferences?.anonymous_mode ?? false
  );

  let sections = buildExportSections(renderedReport, template);

  // Append References section + inject inline [N] markers when the report
  // touches consultations that have research-sourced insights.
  const userId = await requireCurrentUserId();
  const consultationIds = Array.from(
    new Set([
      renderedReport.roundId,
      ...renderedReport.consultations.map((c) => c.id),
    ])
  );
  const refsBundle = await loadReportReferences(consultationIds, userId);
  if (refsBundle.references.length > 0) {
    const numberByLabel = new Map<string, number>();
    for (const [insightId, number] of refsBundle.numberByInsightId.entries()) {
      const label = refsBundle.labelByInsightId.get(insightId);
      if (label) numberByLabel.set(label, number);
    }
    sections = applyReferencesToSections(sections, refsBundle.references, numberByLabel);
  }

  const markdown = serializeToMarkdown({
    id: renderedReport.id,
    title: renderedReport.title,
    roundLabel: renderedReport.roundLabel,
    generatedAt: renderedReport.generatedAt,
    artifactType: renderedReport.artifactType,
    sections,
  });

  const filename = `report-${renderedReport.id.slice(0, 8)}.md`;

  return new NextResponse(markdown, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
