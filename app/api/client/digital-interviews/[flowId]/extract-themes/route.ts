import { NextRequest, NextResponse } from "next/server";
import {
  forwardJsonToAi,
  getAiServiceUrlOrResponse,
  requireAuthenticatedApiUser,
} from "@/lib/api/route-helpers";
import { loadUserAILearnings } from "@/lib/data/ai-learnings";
import { loadRecentThemeLearningSignals } from "@/lib/data/theme-learning";
import { loadUserAIPreferences } from "@/lib/data/user-ai-preferences";
import { getDigitalInterviewCompletedResponses } from "@/lib/data/digital-interviews";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ flowId: string }> }
) {
  const auth = await requireAuthenticatedApiUser();
  if (auth instanceof NextResponse) return auth;

  const aiServiceUrl = getAiServiceUrlOrResponse();
  if (aiServiceUrl instanceof NextResponse) return aiServiceUrl;

  const { flowId } = await params;

  const result = await getDigitalInterviewCompletedResponses(flowId, auth.id);
  if (!result) {
    return NextResponse.json({ detail: "Digital interview not found" }, { status: 404 });
  }

  if (result.responses.length === 0) {
    return NextResponse.json({ detail: "No completed responses to extract themes from" }, { status: 422 });
  }

  const transcript = result.responses
    .map((r) =>
      r.conversation_history
        .filter((m) => m.role === "user")
        .map((m) => m.content)
        .join("\n\n")
    )
    .filter(Boolean)
    .join("\n\n---\n\n");

  let learningSignals: Awaited<ReturnType<typeof loadRecentThemeLearningSignals>> = [];
  let aiLearnings: Awaited<ReturnType<typeof loadUserAILearnings>> = [];
  let userPreferences: Awaited<ReturnType<typeof loadUserAIPreferences>> = null;

  try {
    [learningSignals, aiLearnings, userPreferences] = await Promise.all([
      loadRecentThemeLearningSignals(),
      loadUserAILearnings(auth.id),
      loadUserAIPreferences(),
    ]);
  } catch (err) {
    console.error("Failed to load theme personalization context", err);
  }

  return forwardJsonToAi(aiServiceUrl, "/themes/extract", {
    transcript,
    meeting_id: flowId,
    learning_signals: learningSignals,
    ai_learnings: aiLearnings,
    user_preferences: userPreferences,
  });
}
