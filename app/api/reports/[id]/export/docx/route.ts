export const runtime = "nodejs";

import { getReportArtifact } from "@/lib/actions/reports";
import { loadUserAIPreferences } from "@/lib/data/user-ai-preferences";
import {
  applyReferencesToSections,
  buildExportSections,
  type ReportTemplate,
} from "@/lib/report-export-content";
import { buildDocxBuffer } from "@/lib/report-export-docx";
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
    preferences?.anonymous_mode ?? true
  );

  try {
    let sections = buildExportSections(renderedReport, template);

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
