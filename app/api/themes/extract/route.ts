import { NextRequest, NextResponse } from "next/server";
import {
  forwardJsonToAi,
  getAiServiceUrlOrResponse,
  parseJsonBodyOrResponse,
  requireAuthenticatedApiUser,
} from "@/lib/api/route-helpers";
import { loadRecentThemeLearningSignals } from "@/lib/data/theme-learning";

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

  try {
    learningSignals = await loadRecentThemeLearningSignals();
  } catch (err) {
    console.error("Failed to load theme learning signals", err);
  }

  return forwardJsonToAi(aiServiceUrl, "/themes/extract", {
    ...(body as Record<string, unknown>),
    learning_signals: learningSignals,
  });
}
