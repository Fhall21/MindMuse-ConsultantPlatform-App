import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { profiles } from "@/db/schema";
import { requireAuthenticatedApiUser } from "@/lib/api/route-helpers";

const VALID_INTERVALS = [5, 10, 15, 20] as const;

const patchSchema = z.object({
  interval: z.union([z.enum(["5", "10", "15", "20"]), z.literal("disabled")]),
});

export async function GET(request: NextRequest) {
  const auth = await requireAuthenticatedApiUser();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const [profile] = await db
    .select({ autoTriggerInterval: profiles.autoTriggerInterval })
    .from(profiles)
    .where(eq(profiles.userId, auth.id))
    .limit(1);

  return NextResponse.json({ interval: profile?.autoTriggerInterval ?? null });
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
    .update(profiles)
    .set({ autoTriggerInterval: newInterval })
    .where(eq(profiles.userId, auth.id));

  return NextResponse.json({ interval: newInterval });
}
