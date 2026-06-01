import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedApiUser } from "@/lib/api/route-helpers";
import { saveResearchThemeLinks } from "@/lib/chat/async-actions-db";
import { getUnarchivedSessionForUser } from "@/lib/chat/context";
import { getToolResultForSession, updateToolResult } from "@/lib/chat/persist";

const requestSchema = z.object({
  research_id: z.string().uuid(),
  consultation_id: z.string().uuid(),
  theme_group_ids: z.array(z.string().uuid()).min(1),
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
      { detail: parsed.error.issues[0]?.message ?? "Invalid research link payload" },
      { status: 422 }
    );
  }

  const sessionId = request.headers.get("x-chat-session-id");

  try {
    const links = await saveResearchThemeLinks({
      userId: auth.id,
      consultationId: parsed.data.consultation_id,
      researchId: parsed.data.research_id,
      themeGroupIds: parsed.data.theme_group_ids,
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
              saved_links: links,
            },
            status: "success",
          });
        }
      }
    }

    return NextResponse.json(links, { status: 201 });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Failed to save research links";
    return NextResponse.json({ detail }, { status: 500 });
  }
}
