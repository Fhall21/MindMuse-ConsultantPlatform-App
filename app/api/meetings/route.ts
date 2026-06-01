import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedApiUser } from "@/lib/api/route-helpers";
import { getUnarchivedSessionForUser } from "@/lib/chat/context";
import { confirmMeetingFromDraft, linkPeopleByIdsToMeeting, linkPeopleToMeeting } from "@/lib/chat/intake-db";
import { MEETING_SAVED_FOLLOW_UP } from "@/lib/chat/onboarding-copy";
import { getToolResultForSession, insertChatMessage, updateToolResult } from "@/lib/chat/persist";
import { bindChatSessionConsultation } from "@/lib/chat/theme-extract-flow";
import { startCrossAnalysisJob } from "@/lib/chat/analysis-db";
import { confirmMeetingSchema } from "@/lib/chat/tools/intake";

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

  const parsed = confirmMeetingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { detail: parsed.error.issues[0]?.message ?? "Invalid meeting payload" },
      { status: 422 }
    );
  }

  const sessionId = request.headers.get("x-chat-session-id");
  if (parsed.data.tool_result_id) {
    if (!sessionId) {
      return NextResponse.json({ detail: "Chat session is required" }, { status: 422 });
    }

    const session = await getUnarchivedSessionForUser(auth.id, sessionId);
    if (!session) {
      return NextResponse.json({ detail: "Chat session not found" }, { status: 404 });
    }

    const existingToolResult = await getToolResultForSession(
      parsed.data.tool_result_id,
      sessionId
    );
    if (!existingToolResult) {
      return NextResponse.json({ detail: "Tool result not found" }, { status: 404 });
    }
  }

  try {
    const record = await confirmMeetingFromDraft({
      userId: auth.id,
      projectId: parsed.data.project_id,
      meetingDraft: parsed.data.meeting_draft,
    });

    if (parsed.data.meeting_draft.person_ids?.length) {
      await linkPeopleByIdsToMeeting({
        userId: auth.id,
        meetingId: record.id,
        personIds: parsed.data.meeting_draft.person_ids,
      });
    } else if (parsed.data.meeting_draft.participants.length > 0) {
      await linkPeopleToMeeting({
        userId: auth.id,
        meetingId: record.id,
        participantNames: parsed.data.meeting_draft.participants,
      });
    }

    if (parsed.data.tool_result_id && sessionId) {
      await bindChatSessionConsultation({
        userId: auth.id,
        sessionId,
        consultationId: parsed.data.project_id,
      });

      await updateToolResult({
        toolResultId: parsed.data.tool_result_id,
        sessionId,
        output: {
          meeting_draft: parsed.data.meeting_draft,
          meeting_record: record,
        },
        status: "success",
      });

      await insertChatMessage({
        sessionId,
        role: "assistant",
        content: MEETING_SAVED_FOLLOW_UP,
      });

      void startCrossAnalysisJob({
        userId: auth.id,
        consultationId: parsed.data.project_id,
        sessionId,
      });
    }

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Failed to save meeting";
    return NextResponse.json({ detail }, { status: 500 });
  }
}
