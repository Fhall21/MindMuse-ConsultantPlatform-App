export const runtime = "nodejs";

import { getReportArtifact } from "@/lib/actions/reports";
import { buildExportSections, type ReportTemplate } from "@/lib/report-export-content";
import { buildDocxBuffer } from "@/lib/report-export-docx";
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

  try {
    const sections = buildExportSections(report, template);

    const buffer = await buildDocxBuffer({
      title: report.title,
      roundLabel: report.roundLabel,
      generatedAt: report.generatedAt,
      artifactType: report.artifactType,
      sections,
    });

    const filename = `report-${report.id.slice(0, 8)}.docx`;

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
