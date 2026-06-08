import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedApiUser } from "@/lib/api/route-helpers";
import { checkAndTriggerAutoAnalysis } from "@/lib/analysis/auto-trigger";

const bodySchema = z.object({
  consultation_id: z.string().uuid(),
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

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { detail: parsed.error.issues[0]?.message ?? "Missing consultation_id" },
      { status: 422 }
    );
  }

  const result = await checkAndTriggerAutoAnalysis(auth.id, parsed.data.consultation_id);
  return NextResponse.json(result);
}
