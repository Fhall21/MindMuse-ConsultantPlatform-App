import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { profiles } from "@/db/schema";
import {
  countMeetingsSinceLastAnalysis,
  getLatestCrossAnalysisJob,
  startCrossAnalysisJob,
} from "@/lib/chat/analysis-db";

export async function checkAndTriggerAutoAnalysis(
  userId: string,
  consultationId: string
): Promise<{ triggered: boolean }> {
  const [profile] = await db
    .select({ autoTriggerInterval: profiles.autoTriggerInterval })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  const interval = profile?.autoTriggerInterval ?? null;
  if (interval === null) {
    return { triggered: false };
  }

  const meetingCount = await countMeetingsSinceLastAnalysis(userId, consultationId);
  if (meetingCount < interval) {
    return { triggered: false };
  }

  const existing = await getLatestCrossAnalysisJob(userId, consultationId);
  if (existing && (existing.status === "queued" || existing.status === "running")) {
    return { triggered: false };
  }

  const result = await startCrossAnalysisJob({ userId, consultationId });
  return { triggered: result !== null };
}
