import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { crossAnalysisJobs } from "@/db/schema";
import { requireAuthenticatedApiUser } from "@/lib/api/route-helpers";
import { readCrossAnalysisResults } from "@/lib/chat/analysis-db";

export async function GET(request: NextRequest) {
  const auth = await requireAuthenticatedApiUser();
  if (auth instanceof NextResponse) return auth;

  const consultationId = request.nextUrl.searchParams.get("consultationId");
  if (!consultationId) {
    return NextResponse.json({ detail: "consultationId required" }, { status: 422 });
  }

  const jobs = await db
    .select()
    .from(crossAnalysisJobs)
    .where(
      and(
        eq(crossAnalysisJobs.userId, auth.id),
        eq(crossAnalysisJobs.consultationId, consultationId),
        eq(crossAnalysisJobs.status, "complete")
      )
    )
    .orderBy(desc(crossAnalysisJobs.updatedAt))
    .limit(20);

  const analyses = jobs.map((job) => {
    const results = readCrossAnalysisResults(job.results);
    return {
      id: job.id,
      task_id: job.taskId,
      pattern_count: results?.pattern_count ?? 0,
      transcript_count: results?.transcript_count ?? 0,
      created_at: job.createdAt.toISOString(),
    };
  });

  return NextResponse.json({ analyses });
}
