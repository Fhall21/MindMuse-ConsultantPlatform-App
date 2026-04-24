import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { featureInterests } from "@/db/schema";

export const featureInterestKeySchema = z.enum(["polis_voting", "survey_injection"]);
export const featureInterestCreateSchema = z.object({
  featureKey: featureInterestKeySchema,
});

export interface FeatureInterestSummary {
  feature_key: z.infer<typeof featureInterestKeySchema>;
  count: number;
  interested: boolean;
}

export async function listFeatureInterests(userId: string, keys: string[]) {
  const parsedKeys = keys
    .map((key) => featureInterestKeySchema.safeParse(key))
    .filter((result) => result.success)
    .map((result) => result.data);
  const uniqueKeys = [...new Set(parsedKeys)];

  if (uniqueKeys.length === 0) {
    return [];
  }

  const counts = await db
    .select({
      featureKey: featureInterests.featureKey,
      count: sql<number>`count(*)::int`,
    })
    .from(featureInterests)
    .where(inArray(featureInterests.featureKey, uniqueKeys))
    .groupBy(featureInterests.featureKey);

  const ownInterests = await db
    .select({ featureKey: featureInterests.featureKey })
    .from(featureInterests)
    .where(
      and(
        eq(featureInterests.userId, userId),
        inArray(featureInterests.featureKey, uniqueKeys)
      )
    );

  const countByKey = new Map(counts.map((row) => [row.featureKey, Number(row.count)]));
  const ownKeys = new Set(ownInterests.map((row) => row.featureKey));

  return uniqueKeys.map((key) => ({
    feature_key: key,
    count: countByKey.get(key) ?? 0,
    interested: ownKeys.has(key),
  })) satisfies FeatureInterestSummary[];
}

export async function recordFeatureInterest(userId: string, featureKey: string) {
  const parsed = featureInterestKeySchema.parse(featureKey);

  await db
    .insert(featureInterests)
    .values({ userId, featureKey: parsed })
    .onConflictDoNothing();

  const [summary] = await listFeatureInterests(userId, [parsed]);
  return summary;
}
