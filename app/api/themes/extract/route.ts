import { NextRequest, NextResponse } from "next/server";
import {
  forwardJsonToAi,
  getAiServiceUrlOrResponse,
  parseJsonBodyOrResponse,
  requireAuthenticatedApiUser,
} from "@/lib/api/route-helpers";
import { loadRecentThemeLearningSignals } from "@/lib/data/theme-learning";
import { loadUserAIPreferences } from "@/lib/data/user-ai-preferences";

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedApiUser();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const aiServiceUrl = getAiServiceUrlOrResponse();
  if (aiServiceUrl instanceof NextResponse) {
    return aiServiceUrl;
  }

  const body = await parseJsonBodyOrResponse(request);
  if (body instanceof NextResponse) {
    return body;
  }

  let learningSignals: Awaited<ReturnType<typeof loadRecentThemeLearningSignals>> = [];
  let userPreferences: Awaited<ReturnType<typeof loadUserAIPreferences>> = null;

  try {
    [learningSignals, userPreferences] = await Promise.all([
      loadRecentThemeLearningSignals(),
      loadUserAIPreferences(),
    ]);
  } catch (err) {
    console.error("Failed to load theme personalization context", err);
  }

  return forwardJsonToAi(aiServiceUrl, "/themes/extract", {
    ...(body as Record<string, unknown>),
    learning_signals: learningSignals,
    user_preferences: userPreferences,
  });
}
