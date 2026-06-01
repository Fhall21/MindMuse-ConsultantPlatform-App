import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedApiUser } from "@/lib/api/route-helpers";
import { getUnarchivedSessionForUser } from "@/lib/chat/context";
import {
  getToolResultForSession,
  updateToolResult,
} from "@/lib/chat/persist";
import { meetingDraftSchema } from "@/lib/chat/tools/intake";

const patchSchema = z.object({
  sessionId: z.string().uuid(),
  status: z.enum(["pending", "dismissed"]).optional(),
  meeting_draft: meetingDraftSchema.optional(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedApiUser();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id: toolResultId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON payload" }, { status: 422 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { detail: parsed.error.issues[0]?.message ?? "Invalid tool result payload" },
      { status: 422 }
    );
  }

  const session = await getUnarchivedSessionForUser(auth.id, parsed.data.sessionId);
  if (!session) {
    return NextResponse.json({ detail: "Chat session not found" }, { status: 404 });
  }

  const existing = await getToolResultForSession(toolResultId, parsed.data.sessionId);
  if (!existing) {
    return NextResponse.json({ detail: "Tool result not found" }, { status: 404 });
  }

  const nextOutput =
    parsed.data.meeting_draft !== undefined
      ? {
          ...(typeof existing.output === "object" && existing.output
            ? (existing.output as Record<string, unknown>)
            : {}),
          ...parsed.data.meeting_draft,
        }
      : existing.output;

  const updated = await updateToolResult({
    toolResultId,
    sessionId: parsed.data.sessionId,
    output: nextOutput,
    status: parsed.data.status ?? "pending",
  });

  return NextResponse.json(updated);
}
