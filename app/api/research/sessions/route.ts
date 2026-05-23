import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { requireAuthenticatedApiUser } from "@/lib/api/route-helpers";
import { db } from "@/db/client";
import { researchSessions } from "@/db/schema";

export async function GET() {
  const auth = await requireAuthenticatedApiUser();
  if (auth instanceof NextResponse) return auth;

  const sessions = await db
    .select({
      id: researchSessions.id,
      sessionType: researchSessions.sessionType,
      query: researchSessions.query,
      status: researchSessions.status,
      createdAt: researchSessions.createdAt,
      completedAt: researchSessions.completedAt,
    })
    .from(researchSessions)
    .where(eq(researchSessions.userId, auth.id))
    .orderBy(desc(researchSessions.createdAt))
    .limit(50);

  return NextResponse.json({ sessions });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedApiUser();
  if (auth instanceof NextResponse) return auth;

  let body: {
    query?: string;
    session_type?: string;
    industry_ctx?: string | null;
    file_entry_id?: string | null;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ detail: "Invalid JSON body" }, { status: 400 });
  }

  const { query, session_type = "literature", industry_ctx, file_entry_id } = body;
  if (!query?.trim()) {
    return NextResponse.json({ detail: "query is required" }, { status: 422 });
  }
  if (session_type === "analysis" && !file_entry_id) {
    return NextResponse.json(
      { detail: "file_entry_id is required for analysis sessions" },
      { status: 422 }
    );
  }

  const [session] = await db
    .insert(researchSessions)
    .values({
      userId: auth.id,
      sessionType: (session_type as "literature" | "analysis") ?? "literature",
      query: query.trim(),
      industryCtx: industry_ctx ?? null,
      fileEntryId: file_entry_id ?? null,
      status: "pending",
    })
    .returning({ id: researchSessions.id });

  return NextResponse.json({ id: session.id });
}
