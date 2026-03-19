import { renderToBuffer } from "@react-pdf/renderer";
import { getReportArtifact } from "@/lib/actions/reports";
import { ReportPrintLayout } from "@/components/reports/report-print-layout";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const templateParam = req.nextUrl.searchParams.get("template");
  const template =
    templateParam === "executive" ? "executive" : "standard";

  try {
    const report = await getReportArtifact(id);

    if (!report) {
      return NextResponse.json(
        { error: "Report not found" },
        { status: 404 }
      );
    }

    const buffer = await renderToBuffer(
      <ReportPrintLayout report={report} template={template} />
    );

    const filename = `report-${report.id.slice(0, 8)}.pdf`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("PDF generation failed:", error);
    return NextResponse.json(
      { error: "PDF generation failed" },
      { status: 500 }
    );
  }
}
