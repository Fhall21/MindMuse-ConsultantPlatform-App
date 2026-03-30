export const runtime = "nodejs";

import { getReportArtifact } from "@/lib/actions/reports";
import { buildExportSections, type ReportTemplate } from "@/lib/report-export-content";
import { serializeToMarkdown } from "@/lib/report-export-markdown";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const templateParam = req.nextUrl.searchParams.get("template");
  const template: ReportTemplate = templateParam === "executive" ? "executive" : "standard";

  const report = await getReportArtifact(id);

  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  const sections = buildExportSections(report, template);

  const markdown = serializeToMarkdown({
    id: report.id,
    title: report.title,
    roundLabel: report.roundLabel,
    generatedAt: report.generatedAt,
    artifactType: report.artifactType,
    sections,
  });

  const filename = `report-${report.id.slice(0, 8)}.md`;

  return new NextResponse(markdown, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
