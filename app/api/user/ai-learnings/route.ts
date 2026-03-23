import { NextResponse } from "next/server";
import {
  AI_LEARNING_TOPIC_TYPES,
  DEFAULT_AI_LEARNING_TOPIC_TYPE,
  loadUserAILearnings,
} from "@/lib/data/ai-learnings";
import type { AILearningTopicType } from "@/types/db";
import { jsonError, requireRouteClient } from "../../client/_helpers";

export async function GET(request: Request) {
  const client = await requireRouteClient();
  if ("response" in client) return client.response;

  const url = new URL(request.url);
  const topicTypeParam = url.searchParams.get("topic_type");
  const topicType = topicTypeParam ?? DEFAULT_AI_LEARNING_TOPIC_TYPE;

  if (!isAILearningTopicType(topicType)) {
    return NextResponse.json(
      {
        detail: "Unsupported topic_type",
        supported_topic_types: AI_LEARNING_TOPIC_TYPES,
      },
      { status: 400 }
    );
  }

  try {
    const learnings = await loadUserAILearnings(client.userId, topicType);

    return NextResponse.json({
      topic_type: topicType,
      learnings,
    });
  } catch (error) {
    console.error("Failed to fetch AI learnings:", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to fetch AI learnings"
    );
  }
}

function isAILearningTopicType(value: string): value is AILearningTopicType {
  return AI_LEARNING_TOPIC_TYPES.includes(value as AILearningTopicType);
}
