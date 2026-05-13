import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireAuthenticatedApiUser } from "@/lib/api/route-helpers";
import { db } from "@/db/client";
import { researchSessions } from "@/db/schema";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuthenticatedApiUser();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  let body: { status?: string; result_data?: Record<string, unknown> };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ detail: "Invalid JSON body" }, { status: 400 });
  }

  const updates: {
    status?: "pending" | "running" | "complete" | "failed";
    resultData?: Record<string, unknown>;
    completedAt?: Date;
  } = {};

  if (body.status === "complete" || body.status === "failed" || body.status === "running" || body.status === "pending") {
    updates.status = body.status;
  }
  if (body.result_data) {
    updates.resultData = body.result_data;
  }
  if (body.status === "complete" || body.status === "failed") {
    updates.completedAt = new Date();
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ detail: "No valid fields to update" }, { status: 422 });
  }

  await db
    .update(researchSessions)
    .set(updates)
    .where(
      and(eq(researchSessions.id, id), eq(researchSessions.userId, auth.id))
    );

  return NextResponse.json({ ok: true });
}
