"use server";

import { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { aiInsightLearnings, insightDecisionLogs } from "@/db/schema";
import { getAiServiceUrl } from "@/lib/env";
import type { AIInsightLearning, AILearningTopicType } from "@/types/db";

export const DEFAULT_AI_LEARNING_TOPIC_TYPE: AILearningTopicType =
  "theme_generation";

export const AI_LEARNING_TOPIC_TYPES = [
  DEFAULT_AI_LEARNING_TOPIC_TYPE,
] as const satisfies readonly AILearningTopicType[];

export async function getThemeLearningSignalCountForUser(userId: string) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(insightDecisionLogs)
    .where(eq(insightDecisionLogs.userId, userId));

  return row?.count ?? 0;
}

export async function enqueueLearningAnalysis(
  userId: string,
  topicType: AILearningTopicType = DEFAULT_AI_LEARNING_TOPIC_TYPE
) {
  const aiServiceUrl = getAiServiceUrl();
  const response = await fetch(`${aiServiceUrl}/tasks/learning/compute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, topic_type: topicType }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      detail || `Learning analysis enqueue failed with status ${response.status}`
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return null;
  }

  return response.json();
}

export async function loadUserAILearnings(
  userId: string,
  topicType: AILearningTopicType = DEFAULT_AI_LEARNING_TOPIC_TYPE
): Promise<AIInsightLearning[]> {
  const now = new Date();

  const rows = await db
    .select({
      id: aiInsightLearnings.id,
      user_id: aiInsightLearnings.userId,
      topic_type: aiInsightLearnings.topicType,
      learning_type: aiInsightLearnings.learningType,
      label: aiInsightLearnings.label,
      description: aiInsightLearnings.description,
      supporting_metrics: aiInsightLearnings.supportingMetrics,
      created_at: aiInsightLearnings.createdAt,
      expires_at: aiInsightLearnings.expiresAt,
      version: aiInsightLearnings.version,
    })
    .from(aiInsightLearnings)
    .where(
      and(
        eq(aiInsightLearnings.userId, userId),
        eq(aiInsightLearnings.topicType, topicType),
        orActiveLearning(now)
      )
    )
    .orderBy(desc(aiInsightLearnings.createdAt), desc(aiInsightLearnings.label));

  return rows.map((row) => ({
    ...row,
    topic_type: row.topic_type as AILearningTopicType,
    learning_type: row.learning_type as AIInsightLearning["learning_type"],
    created_at: row.created_at.toISOString(),
    expires_at: row.expires_at?.toISOString() ?? null,
  }));
}

function orActiveLearning(now: Date) {
  return or(
    isNull(aiInsightLearnings.expiresAt),
    gt(aiInsightLearnings.expiresAt, now)
  );
}
