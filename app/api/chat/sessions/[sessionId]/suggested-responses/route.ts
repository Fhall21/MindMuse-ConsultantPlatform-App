import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedApiUser } from "@/lib/api/route-helpers";
import { getUnarchivedSessionForUser } from "@/lib/chat/context";
import { resolveSuggestedResponsesForSession } from "@/lib/chat/suggested-responses-service";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  const auth = await requireAuthenticatedApiUser();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { sessionId } = await context.params;
  const session = await getUnarchivedSessionForUser(auth.id, sessionId);
  if (!session) {
    return NextResponse.json({ detail: "Chat session not found" }, { status: 404 });
  }

  const anchorMessageId = _request.nextUrl.searchParams.get("messageId");
  const { messageId, suggestedResponses } = await resolveSuggestedResponsesForSession(
    session.id,
    anchorMessageId
  );

  return NextResponse.json({
    messageId,
    suggestedResponses,
  });
}
