import { and, eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedApiUser } from "@/lib/api/route-helpers";
import { db } from "@/db/client";
import { chatSessions, consultations } from "@/db/schema";

const patchSchema = z.object({
  sessionId: z.string().uuid(),
  consultationId: z.string().uuid(),
});

export async function PATCH(request: NextRequest) {
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

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { detail: parsed.error.issues[0]?.message ?? "Invalid session payload" },
      { status: 422 }
    );
  }

  const [ownedConsultation] = await db
    .select({ id: consultations.id })
    .from(consultations)
    .where(
      and(
        eq(consultations.id, parsed.data.consultationId),
        eq(consultations.userId, auth.id)
      )
    )
    .limit(1);

  if (!ownedConsultation) {
    return NextResponse.json({ detail: "Consultation not found" }, { status: 404 });
  }

  const [updated] = await db
    .update(chatSessions)
    .set({
      consultationId: parsed.data.consultationId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(chatSessions.id, parsed.data.sessionId),
        eq(chatSessions.userId, auth.id),
        isNull(chatSessions.archivedAt)
      )
    )
    .returning();

  if (!updated) {
    return NextResponse.json({ detail: "Chat session not found" }, { status: 404 });
  }

  return NextResponse.json({
    sessionId: updated.id,
    consultationId: updated.consultationId,
    userMode: updated.userMode,
  });
}
