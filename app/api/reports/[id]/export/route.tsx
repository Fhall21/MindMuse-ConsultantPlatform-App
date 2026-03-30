import React from "react";
import { renderToBuffer, Document, Page } from "@react-pdf/renderer";
import { PDFDocument as PdfLibDoc } from "pdf-lib";
import { getReportArtifact } from "@/lib/actions/reports";
import {
  ReportPrintLayout,
  buildSectionElements,
  CONTENT_PAGE_STYLE,
  type TocPageNumbers,
} from "@/components/reports/report-print-layout";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const templateParam = req.nextUrl.searchParams.get("template");
  const template = templateParam === "executive" ? "executive" : "standard";

  try {
    const report = await getReportArtifact(id);

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // ── Two-pass TOC page numbers ────────────────────────────────────────────
    // Pass 1: render each section in isolation to count its pages.
    // Pass 2: render the full document with accurate TOC page numbers.
    //
    // Title = page 1, TOC = page 2, sections start at page 3.
    // On any error, fall back to rendering without TOC page numbers (TOC shows "—").

    let tocPageNumbers: TocPageNumbers | undefined;

    try {
      const sections = buildSectionElements(report, template);
      const accumulated: TocPageNumbers = {};
      let cursor = 3; // pages 1 (title) and 2 (TOC) are always present

      for (const section of sections) {
        const miniBuffer = await renderToBuffer(
          React.createElement(
            Document,
            null,
            React.createElement(
              Page,
              { size: "LETTER", style: CONTENT_PAGE_STYLE, wrap: true },
              section.element
            )
          )
        );
        const pdfDoc = await PdfLibDoc.load(miniBuffer);
        accumulated[section.id] = cursor;
        cursor += pdfDoc.getPageCount();
      }

      tocPageNumbers = accumulated;
    } catch (passOneErr) {
      console.warn(
        "[PDF export] Two-pass page counting failed, TOC will show '—' for page numbers:",
        passOneErr
      );
    }

    // ── Pass 2: full render ──────────────────────────────────────────────────
    const buffer = await renderToBuffer(
      <ReportPrintLayout
        report={report}
        template={template}
        tocPageNumbers={tocPageNumbers}
      />
    );

    const filename = `report-${report.id.slice(0, 8)}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("PDF generation failed:", error);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}
