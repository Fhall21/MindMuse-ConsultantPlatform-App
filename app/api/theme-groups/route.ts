import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedApiUser } from "@/lib/api/route-helpers";
import { getUnarchivedSessionForUser } from "@/lib/chat/context";
import { confirmGroupingFromChat } from "@/lib/chat/grouping-db";
import { getToolResultForSession, updateToolResult } from "@/lib/chat/persist";
import { confirmGroupingSchema } from "@/lib/chat/tools/grouping";

const requestSchema = confirmGroupingSchema.extend({
  consultation_id: z.string().uuid(),
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
      { detail: parsed.error.issues[0]?.message ?? "Invalid theme group payload" },
      { status: 422 }
    );
  }

  const sessionId = request.headers.get("x-chat-session-id");

  try {
    const group = await confirmGroupingFromChat({
      userId: auth.id,
      consultationId: parsed.data.consultation_id,
      groupName: parsed.data.group_name,
      groupDescription: parsed.data.group_description,
      themeIds: parsed.data.theme_ids,
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
              ...(typeof existing.output === "object" && existing.output
                ? existing.output
                : {}),
              saved_group: group,
            },
            status: "success",
          });
        }
      }
    }

    return NextResponse.json(group, { status: 201 });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Failed to save theme group";
    return NextResponse.json({ detail }, { status: 500 });
  }
}
