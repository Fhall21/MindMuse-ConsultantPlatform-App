"use server";

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { digitalInterviewFlows, insights } from "@/db/schema";

export interface DigitalInterviewTheme {
  id: string;
  flow_id: string;
  label: string;
  description: string | null;
  accepted: boolean;
  is_user_added: boolean;
  weight: string;
  created_at: string;
}

type InsightRow = typeof insights.$inferSelect;

function mapInsightRow(row: InsightRow): DigitalInterviewTheme {
  return {
    id: row.id,
    flow_id: row.flowId!,
    label: row.label,
    description: row.description,
    accepted: row.accepted,
    is_user_added: row.isUserAdded,
    weight: row.weight,
    created_at: row.createdAt.toISOString(),
  };
}

export async function requireOwnedFlow(flowId: string, userId: string) {
  const [flow] = await db
    .select()
    .from(digitalInterviewFlows)
    .where(and(eq(digitalInterviewFlows.id, flowId), eq(digitalInterviewFlows.userId, userId)))
    .limit(1);

  if (!flow) throw new Error("Digital interview not found");
  return flow;
}

export async function listDigitalInterviewThemes(
  flowId: string,
  userId: string
): Promise<DigitalInterviewTheme[]> {
  await requireOwnedFlow(flowId, userId);

  const rows = await db
    .select()
    .from(insights)
    .where(eq(insights.flowId, flowId))
    .orderBy(desc(insights.createdAt));

  return rows.map(mapInsightRow);
}

export async function saveDigitalInterviewThemes(
  flowId: string,
  userId: string,
  themeItems: Array<{ label: string; description?: string | null; confidence?: number }>
): Promise<DigitalInterviewTheme[]> {
  await requireOwnedFlow(flowId, userId);

  await db.delete(insights).where(eq(insights.flowId, flowId));

  if (themeItems.length === 0) return [];

  const rows = await db
    .insert(insights)
    .values(
      themeItems.map((t) => ({
        flowId,
        label: t.label,
        description: t.description ?? null,
        accepted: false,
        isUserAdded: false,
      }))
    )
    .returning();

  return rows.map(mapInsightRow);
}

export async function acceptDigitalInterviewTheme(
  themeId: string,
  flowId: string,
  userId: string
): Promise<void> {
  await requireOwnedFlow(flowId, userId);

  const updated = await db
    .update(insights)
    .set({ accepted: true })
    .where(and(eq(insights.id, themeId), eq(insights.flowId, flowId)))
    .returning({ id: insights.id });

  if (updated.length === 0) throw new Error("Theme not found");
}

export async function rejectDigitalInterviewTheme(
  themeId: string,
  flowId: string,
  userId: string
): Promise<void> {
  await requireOwnedFlow(flowId, userId);

  await db.delete(insights).where(and(eq(insights.id, themeId), eq(insights.flowId, flowId)));
}
