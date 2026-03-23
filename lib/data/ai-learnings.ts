"use server";

import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { insightDecisionLogs } from "@/db/schema";
import { getAiServiceUrl } from "@/lib/env";

const DEFAULT_TOPIC_TYPE = "theme_generation";

export async function getThemeLearningSignalCountForUser(userId: string) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(insightDecisionLogs)
    .where(eq(insightDecisionLogs.userId, userId));

  return row?.count ?? 0;
}

export async function enqueueLearningAnalysis(
  userId: string,
  topicType = DEFAULT_TOPIC_TYPE
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