import { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  aiInsightLearnings,
  insightDecisionLogs,
  userAIPreferences,
} from "@/db/schema";
import { getAiServiceUrl } from "@/lib/env";
import { DEFAULT_AI_LEARNING_TOPIC_TYPE } from "@/lib/data/ai-learning-topics";
import type { AIInsightLearning, AILearningTopicType } from "@/types/db";

// True-debounce window: how far into the future to push the analysis deadline
// each time a new signal arrives. Resets the window on every accept/reject.
const LEARNING_ANALYSIS_DEBOUNCE_SECONDS = 60;

export async function getThemeLearningSignalCountForUser(userId: string) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(insightDecisionLogs)
    .where(eq(insightDecisionLogs.userId, userId));

  return row?.count ?? 0;
}

/**
 * Schedule a learning analysis for userId using a true-debounce pattern.
 *
 * Every call resets next_learning_analysis_at to now()+60s, so rapid-fire
 * signals (e.g. 3 accepts in one meeting session) accumulate in the DB first
 * and the AI service worker fires a single analysis once the burst is over.
 *
 * The AI service polls user_ai_preferences for rows where
 * next_learning_analysis_at <= now() and runs the analysis then.
 */
export async function scheduleLearningAnalysis(
  userId: string,
  _topicType: AILearningTopicType = DEFAULT_AI_LEARNING_TOPIC_TYPE
) {
  await db
    .insert(userAIPreferences)
    .values({
      userId,
      nextLearningAnalysisAt: sql`now() + interval '${sql.raw(String(LEARNING_ANALYSIS_DEBOUNCE_SECONDS))} seconds'`,
    })
    .onConflictDoUpdate({
      target: userAIPreferences.userId,
      set: {
        nextLearningAnalysisAt: sql`now() + interval '${sql.raw(String(LEARNING_ANALYSIS_DEBOUNCE_SECONDS))} seconds'`,
      },
    });
}

export async function enqueueLearningAnalysis(
  userId: string,
  topicType: AILearningTopicType = DEFAULT_AI_LEARNING_TOPIC_TYPE
) {
  const aiServiceUrl = getAiServiceUrl();
  console.info("[ai-learnings.enqueue] request start", {
    userId,
    topicType,
    aiServiceUrl,
  });

  let response: Response;

  try {
    response = await fetch(`${aiServiceUrl}/tasks/learning/compute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, topic_type: topicType }),
    });
  } catch (error) {
    console.error("[ai-learnings.enqueue] request failed", {
      userId,
      topicType,
      aiServiceUrl,
      error,
    });
    throw error;
  }

  console.info("[ai-learnings.enqueue] response received", {
    userId,
    topicType,
    status: response.status,
    ok: response.ok,
    contentType: response.headers.get("content-type"),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("[ai-learnings.enqueue] request rejected", {
      userId,
      topicType,
      status: response.status,
      detail,
    });
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

  let rows;

  try {
    rows = await db
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
      .orderBy(
        desc(aiInsightLearnings.createdAt),
        desc(aiInsightLearnings.label)
      );
  } catch (error) {
    if (isMissingAILearningsStorageError(error)) {
      return [];
    }

    throw error;
  }

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

function isMissingAILearningsStorageError(error: unknown): boolean {
  const details = collectErrorDetails(error);

  return details.some(
    (detail) =>
      detail.code === "42P01" ||
      detail.code === "42703" ||
      detail.message.includes('relation "ai_insight_learnings" does not exist') ||
      detail.message.includes('column "supporting_metrics" does not exist') ||
      detail.message.includes('column "learning_type" does not exist')
  );
}

function collectErrorDetails(error: unknown): Array<{ code?: string; message: string }> {
  const pending = [error];
  const seen = new Set<unknown>();
  const details: Array<{ code?: string; message: string }> = [];

  while (pending.length > 0) {
    const current = pending.pop();

    if (!current || seen.has(current)) {
      continue;
    }

    seen.add(current);

    if (current instanceof Error) {
      details.push({
        code: getErrorCode(current),
        message: current.message.toLowerCase(),
      });

      const errorWithCause = current as Error & { cause?: unknown };
      if (errorWithCause.cause) {
        pending.push(errorWithCause.cause);
      }

      continue;
    }

    if (typeof current === "object") {
      const candidate = current as {
        code?: unknown;
        message?: unknown;
        cause?: unknown;
      };

      if (typeof candidate.message === "string") {
        details.push({
          code: typeof candidate.code === "string" ? candidate.code : undefined,
          message: candidate.message.toLowerCase(),
        });
      }

      if (candidate.cause) {
        pending.push(candidate.cause);
      }
    }
  }

  return details;
}

function getErrorCode(error: Error): string | undefined {
  const errorWithCode = error as Error & { code?: unknown };
  return typeof errorWithCode.code === "string" ? errorWithCode.code : undefined;
}
