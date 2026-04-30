export const runtime = "nodejs";

import { getReportArtifact } from "@/lib/actions/reports";
import { loadUserAIPreferences } from "@/lib/data/user-ai-preferences";
import { buildExportSections, type ReportTemplate } from "@/lib/report-export-content";
import { serializeToMarkdown } from "@/lib/report-export-markdown";
import { applyRenderPolicyToReport } from "@/lib/report-render-policy";
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

  const sections = buildExportSections(renderedReport, template);

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
