import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedApiUser } from "@/lib/api/route-helpers";
import { db } from "@/db/client";
import { researchSessions } from "@/db/schema";

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedApiUser();
  if (auth instanceof NextResponse) return auth;

  let body: { query?: string; session_type?: string; industry_ctx?: string | null };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ detail: "Invalid JSON body" }, { status: 400 });
  }

  const { query, session_type = "literature", industry_ctx } = body;
  if (!query?.trim()) {
    return NextResponse.json({ detail: "query is required" }, { status: 422 });
  }

  const [session] = await db
    .insert(researchSessions)
    .values({
      userId: auth.id,
      sessionType: (session_type as "literature" | "analysis") ?? "literature",
      query: query.trim(),
      industryCtx: industry_ctx ?? null,
      status: "running",
    })
    .returning({ id: researchSessions.id });

  return NextResponse.json({ id: session.id });
}
