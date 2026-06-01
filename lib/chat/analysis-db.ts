import { and, count, desc, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db } from "@/db/client";
import { crossAnalysisJobs, meetings } from "@/db/schema";
import { requireOwnedConsultation } from "@/lib/data/ownership";
import { getAiServiceUrl } from "@/lib/env";
import { createChatServiceToken } from "./service-token";

export interface CrossAnalysisFinding {
  id: string;
  summary: string;
  theme_ids: string[];
}

export interface CrossAnalysisResults {
  pattern_count: number;
  transcript_count: number;
  findings: CrossAnalysisFinding[];
}

export async function countProcessedMeetingsForConsultation(
  userId: string,
  consultationId: string
): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(meetings)
    .where(
      and(
        eq(meetings.userId, userId),
        eq(meetings.consultationId, consultationId),
        eq(meetings.isArchived, false)
      )
    );
  return row?.count ?? 0;
}

export async function getLatestCrossAnalysisJob(
  userId: string,
  consultationId: string
) {
  const [row] = await db
    .select()
    .from(crossAnalysisJobs)
    .where(
      and(
        eq(crossAnalysisJobs.userId, userId),
        eq(crossAnalysisJobs.consultationId, consultationId)
      )
    )
    .orderBy(desc(crossAnalysisJobs.updatedAt))
    .limit(1);

  return row ?? null;
}

export async function startCrossAnalysisJob(params: {
  userId: string;
  consultationId: string;
  sessionId?: string;
}): Promise<{ task_id: string; status: "queued" } | null> {
  await requireOwnedConsultation(params.consultationId, params.userId);

  const meetingCount = await countProcessedMeetingsForConsultation(
    params.userId,
    params.consultationId
  );
  if (meetingCount < 2) {
    return null;
  }

  const existing = await getLatestCrossAnalysisJob(params.userId, params.consultationId);
  if (existing && (existing.status === "queued" || existing.status === "running")) {
    return { task_id: existing.taskId, status: "queued" };
  }

  const taskId = randomUUID();
  await db.insert(crossAnalysisJobs).values({
    taskId,
    userId: params.userId,
    consultationId: params.consultationId,
    status: "queued",
  });

  const aiServiceUrl = getAiServiceUrl();
  const token = createChatServiceToken({
    userId: params.userId,
    sessionId: params.sessionId ?? taskId,
  });

  void fetch(`${aiServiceUrl}/analysis/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      consultation_id: params.consultationId,
      task_id: taskId,
    }),
  }).catch((error) => {
    console.warn("[analysis-db] failed to dispatch FastAPI analysis job", error);
  });

  return { task_id: taskId, status: "queued" };
}

export function readCrossAnalysisResults(
  value: unknown
): CrossAnalysisResults | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const findingsRaw = record.findings;
  const findings: CrossAnalysisFinding[] = [];
  if (Array.isArray(findingsRaw)) {
    for (const item of findingsRaw) {
      if (!item || typeof item !== "object") continue;
      const finding = item as Record<string, unknown>;
      if (typeof finding.summary !== "string") continue;
      findings.push({
        id: typeof finding.id === "string" ? finding.id : randomUUID(),
        summary: finding.summary,
        theme_ids: Array.isArray(finding.theme_ids)
          ? finding.theme_ids.filter((id): id is string => typeof id === "string")
          : [],
      });
    }
  }

  return {
    pattern_count:
      typeof record.pattern_count === "number"
        ? record.pattern_count
        : findings.length,
    transcript_count:
      typeof record.transcript_count === "number" ? record.transcript_count : 0,
    findings,
  };
}
