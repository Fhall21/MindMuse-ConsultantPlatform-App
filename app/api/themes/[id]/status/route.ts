import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedApiUser } from "@/lib/api/route-helpers";
import { getUnarchivedSessionForUser } from "@/lib/chat/context";
import { recordOnboardingMilestone } from "@/lib/chat/onboarding-state";
import {
  getToolResultForSession,
  updateToolResult,
} from "@/lib/chat/persist";
import {
  readThemeReviewOutput,
  themeReviewItemSchema,
} from "@/lib/chat/tools/themes";
import {
  acceptInsightForMeeting,
  hasAnyAcceptedDecision,
  mergeThemeDecision,
  rejectInsightForMeeting,
} from "@/lib/chat/themes-db";

const patchSchema = z.object({
  meeting_id: z.string().uuid(),
  status: z.enum(["accepted", "rejected"]),
  rationale: z.string().optional(),
  session_id: z.string().uuid().optional(),
  tool_result_id: z.string().uuid().optional(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedApiUser();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id: insightId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON payload" }, { status: 422 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { detail: parsed.error.issues[0]?.message ?? "Invalid theme status payload" },
      { status: 422 }
    );
  }

  const { meeting_id, status, rationale, session_id, tool_result_id } = parsed.data;

  if (session_id) {
    const session = await getUnarchivedSessionForUser(auth.id, session_id);
    if (!session) {
      return NextResponse.json({ detail: "Chat session not found" }, { status: 404 });
    }
  }

  if (tool_result_id && session_id) {
    const existing = await getToolResultForSession(tool_result_id, session_id);
    if (!existing) {
      return NextResponse.json({ detail: "Tool result not found" }, { status: 404 });
    }
  }

  let hadPriorAccept = false;
  if (tool_result_id && session_id) {
    const existing = await getToolResultForSession(tool_result_id, session_id);
    const reviewOutput = existing ? readThemeReviewOutput(existing.output) : null;
    hadPriorAccept = reviewOutput ? hasAnyAcceptedDecision(reviewOutput.decisions) : false;
  }

  try {
    if (status === "accepted") {
      await acceptInsightForMeeting({
        userId: auth.id,
        meetingId: meeting_id,
        insightId,
      });
    } else {
      await rejectInsightForMeeting({
        userId: auth.id,
        meetingId: meeting_id,
        insightId,
        rationale,
      });
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Failed to update theme status";
    return NextResponse.json({ detail }, { status: 500 });
  }

  if (
    status === "accepted" &&
    session_id &&
    !hadPriorAccept
  ) {
    await recordOnboardingMilestone(auth.id, session_id, "insight_accept");
  }

  if (tool_result_id && session_id) {
    const existing = await getToolResultForSession(tool_result_id, session_id);
    const reviewOutput = existing ? readThemeReviewOutput(existing.output) : null;
    if (reviewOutput) {
      const nextOutput = mergeThemeDecision(reviewOutput, insightId, status);
      await updateToolResult({
        toolResultId: tool_result_id,
        sessionId: session_id,
        output: nextOutput,
        status: "pending",
      });
    }
  }

  return NextResponse.json({ id: insightId, status });
}
