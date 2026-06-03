import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedApiUser } from "@/lib/api/route-helpers";
import { getUnarchivedSessionForUser } from "@/lib/chat/context";
import { runMeetingPickerContinue } from "@/lib/chat/meeting-picker-continue";

const continueSchema = z.object({
  sessionId: z.string().uuid(),
  meetingId: z.string().uuid(),
  toolResultId: z.string().uuid().optional(),
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

  const parsed = continueSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { detail: parsed.error.issues[0]?.message ?? "Invalid meeting continue payload" },
      { status: 422 }
    );
  }

  const session = await getUnarchivedSessionForUser(auth.id, parsed.data.sessionId);
  if (!session) {
    return NextResponse.json({ detail: "Chat session not found" }, { status: 404 });
  }

  const result = await runMeetingPickerContinue({
    userId: auth.id,
    sessionId: parsed.data.sessionId,
    meetingId: parsed.data.meetingId,
    pickerToolResultId: parsed.data.toolResultId,
  });

  if (!result.ok) {
    return NextResponse.json({ detail: result.error }, { status: 400 });
  }

  return NextResponse.json(result);
}
