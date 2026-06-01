import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedApiUser } from "@/lib/api/route-helpers";
import { getUnarchivedSessionForUser } from "@/lib/chat/context";
import { extractThemesFromPickerCard } from "@/lib/chat/theme-extract-flow";

const extractThemesFromPickerSchema = z.object({
  sessionId: z.string().uuid(),
  meetingId: z.string().uuid(),
  pickerToolResultId: z.string().uuid().optional(),
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

  const parsed = extractThemesFromPickerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { detail: parsed.error.issues[0]?.message ?? "Invalid theme extraction payload" },
      { status: 422 }
    );
  }

  const session = await getUnarchivedSessionForUser(auth.id, parsed.data.sessionId);
  if (!session) {
    return NextResponse.json({ detail: "Chat session not found" }, { status: 404 });
  }

  const result = await extractThemesFromPickerCard({
    userId: auth.id,
    sessionId: parsed.data.sessionId,
    meetingId: parsed.data.meetingId,
    pickerToolResultId: parsed.data.pickerToolResultId,
  });

  if (!result.ok) {
    return NextResponse.json({ detail: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ...result.output,
    tool_result_id: result.toolResultId,
  });
}
