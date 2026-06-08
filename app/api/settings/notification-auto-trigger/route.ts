import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { userPreferences } from "@/db/schema";
import { requireAuthenticatedApiUser } from "@/lib/api/route-helpers";
import { eq } from "drizzle-orm";

const patchSchema = z.object({
  interval: z.union([z.enum(["5", "10", "15", "20"]), z.literal("disabled")]),
});

export async function GET(request: NextRequest) {
  const auth = await requireAuthenticatedApiUser();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const [prefs] = await db
    .select({ autoTriggerInterval: userPreferences.autoTriggerInterval })
    .from(userPreferences)
    .where(eq(userPreferences.userId, auth.id))
    .limit(1);

  return NextResponse.json({ interval: prefs?.autoTriggerInterval ?? null });
}

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
      { detail: "interval must be 5, 10, 15, 20, or disabled" },
      { status: 422 }
    );
  }

  const newInterval =
    parsed.data.interval === "disabled" ? null : Number(parsed.data.interval);

  await db
    .insert(userPreferences)
    .values({ userId: auth.id, autoTriggerInterval: newInterval })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { autoTriggerInterval: newInterval, updatedAt: new Date() },
    });

  return NextResponse.json({ interval: newInterval });
}
