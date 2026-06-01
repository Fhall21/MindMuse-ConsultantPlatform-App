import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedApiUser } from "@/lib/api/route-helpers";
import { saveEmailDraftFromChat } from "@/lib/chat/async-actions-db";
import { getUnarchivedSessionForUser } from "@/lib/chat/context";
import { getToolResultForSession, updateToolResult } from "@/lib/chat/persist";

const requestSchema = z.object({
  meeting_id: z.string().uuid(),
  subject: z.string().min(1),
  body: z.string().min(1),
  draft_id: z.string().optional(),
  tool_result_id: z.string().uuid().optional(),
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

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { detail: parsed.error.issues[0]?.message ?? "Invalid email draft payload" },
      { status: 422 }
    );
  }

  const sessionId = request.headers.get("x-chat-session-id");

  try {
    const saved = await saveEmailDraftFromChat({
      userId: auth.id,
      meetingId: parsed.data.meeting_id,
      subject: parsed.data.subject,
      body: parsed.data.body,
    });

    if (parsed.data.tool_result_id && sessionId) {
      const session = await getUnarchivedSessionForUser(auth.id, sessionId);
      if (session) {
        const existing = await getToolResultForSession(parsed.data.tool_result_id, sessionId);
        if (existing) {
          await updateToolResult({
            toolResultId: parsed.data.tool_result_id,
            sessionId,
            output: {
              ...(typeof existing.output === "object" && existing.output ? existing.output : {}),
              saved_draft_id: saved.id,
            },
            status: "success",
          });
        }
      }
    }

    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Failed to save email draft";
    return NextResponse.json({ detail }, { status: 500 });
  }
}
