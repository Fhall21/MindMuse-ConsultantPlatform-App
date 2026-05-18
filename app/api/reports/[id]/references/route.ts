export const runtime = "nodejs";

import { type NextRequest, NextResponse } from "next/server";
import { getReportArtifact } from "@/lib/actions/reports";
import { requireCurrentUserId } from "@/lib/data/auth-context";
import { loadReportReferences } from "@/lib/report-references";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let userId: string;
  try {
    userId = await requireCurrentUserId();
  } catch {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const report = await getReportArtifact(id);
  if (!report) {
    return NextResponse.json({ detail: "Report not found" }, { status: 404 });
  }

  const consultationIds = Array.from(
    new Set([report.roundId, ...report.consultations.map((c) => c.id)])
  );

  const bundle = await loadReportReferences(consultationIds, userId);
  return NextResponse.json({
    references: bundle.references,
    insightLabels: Object.fromEntries(bundle.labelByInsightId.entries()),
    insightNumbers: Object.fromEntries(bundle.numberByInsightId.entries()),
  });
}
