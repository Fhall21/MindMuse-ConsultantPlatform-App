export const runtime = "nodejs";

import { getReportArtifact } from "@/lib/actions/reports";
import { loadUserAIPreferences } from "@/lib/data/user-ai-preferences";
import { buildExportSections, type ReportTemplate } from "@/lib/report-export-content";
import { buildDocxBuffer } from "@/lib/report-export-docx";
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

  try {
    const sections = buildExportSections(renderedReport, template);

    const buffer = await buildDocxBuffer({
      title: renderedReport.title,
      roundLabel: renderedReport.roundLabel,
      generatedAt: renderedReport.generatedAt,
      artifactType: renderedReport.artifactType,
      sections,
    });

    const filename = `report-${renderedReport.id.slice(0, 8)}.docx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Docx generation failed:", error);
    return NextResponse.json({ error: "Docx generation failed" }, { status: 500 });
  }
}
