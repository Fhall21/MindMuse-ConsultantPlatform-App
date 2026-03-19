import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { profiles, users } from "@/db/schema";
import { getAuthSession } from "@/lib/auth";

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function GET() {
  const session = await getAuthSession();

  if (!session) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    email: session.user.email,
    displayName: session.profile?.displayName ?? "",
    fullName: session.profile?.fullName ?? "",
  });
}

export async function PATCH(request: Request) {
  const session = await getAuthSession();

  if (!session) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON payload" }, { status: 422 });
  }

  const displayName = normalizeOptionalString(
    typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>).displayName : undefined
  );
  const fullName = normalizeOptionalString(
    typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>).fullName : undefined
  );

  await db
    .insert(profiles)
    .values({
      userId: session.user.id,
      displayName,
      fullName,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: profiles.userId,
      set: {
        displayName,
        fullName,
        updatedAt: new Date(),
      },
    });

  const preferredName = displayName ?? fullName;
  if (preferredName && preferredName !== session.user.name) {
    await db
      .update(users)
      .set({
        name: preferredName,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.user.id));
  }

  return NextResponse.json({
    displayName: displayName ?? "",
    fullName: fullName ?? "",
  });
}
