import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedApiUser } from "@/lib/api/route-helpers";
import { startCrossAnalysisJob } from "@/lib/chat/analysis-db";

const requestSchema = z.object({
  consultation_id: z.string().uuid(),
  session_id: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedApiUser();
  if (auth instanceof NextResponse) {
    return auth;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON payload" }, { status: 422 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { detail: parsed.error.issues[0]?.message ?? "Invalid analysis payload" },
      { status: 422 }
    );
  }

  const started = await startCrossAnalysisJob({
    userId: auth.id,
    consultationId: parsed.data.consultation_id,
    sessionId: parsed.data.session_id,
  });

  if (!started) {
    return NextResponse.json(
      { detail: "Cross-analysis requires at least two meetings." },
      { status: 422 }
    );
  }

  return NextResponse.json(started);
}
