"use server";

import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { insightDecisionLogs } from "@/db/schema";
import { getCurrentUserId } from "./auth-context";

export interface ThemeLearningSignal {
  label: string;
  decision_type: "accept" | "reject" | "user_added";
  rationale: string | null;
  weight: number;
}

function getSignalWeight(decisionType: ThemeLearningSignal["decision_type"]) {
  return decisionType === "user_added" ? 2 : 1;
}

export async function loadRecentThemeLearningSignals(limit = 20) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return [] as ThemeLearningSignal[];
  }

  const rows = await db
    .select({
      insightLabel: insightDecisionLogs.insightLabel,
      decisionType: insightDecisionLogs.decisionType,
      rationale: insightDecisionLogs.rationale,
    })
    .from(insightDecisionLogs)
    .where(eq(insightDecisionLogs.userId, userId))
    .orderBy(desc(insightDecisionLogs.createdAt))
    .limit(limit);

  return rows
    .filter((row): row is { insightLabel: string; decisionType: ThemeLearningSignal["decision_type"]; rationale: string | null } =>
      Boolean(row.insightLabel)
    )
    .map((row) => ({
      label: row.insightLabel,
      decision_type: row.decisionType,
      rationale: row.rationale,
      weight: getSignalWeight(row.decisionType),
    }));
}
