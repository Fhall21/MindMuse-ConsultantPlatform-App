import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { userAIPreferences, insightDecisionLogs } from "@/db/schema";
import { jsonError, requireRouteClient } from "../_helpers";
import { aiPreferencesSchema } from "@/lib/validations/ai-preferences";
import { emitAuditEvent } from "@/lib/data/audit-log";
import { sql } from "drizzle-orm";

export async function GET() {
  const client = await requireRouteClient();
  if ("response" in client) return client.response;

  try {
    const rows = await db
      .select()
      .from(userAIPreferences)
      .where(eq(userAIPreferences.userId, client.userId))
      .limit(1);

    if (rows.length === 0) {
      const [created] = await db
        .insert(userAIPreferences)
        .values({
          userId: client.userId,
          consultationTypes: [],
          focusAreas: [],
          excludedTopics: [],
        })
        .returning();

      return NextResponse.json({
        ...created,
        signalCount: 0,
      });
    }

    const [signalCountRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(insightDecisionLogs)
      .where(eq(insightDecisionLogs.userId, client.userId));

    return NextResponse.json({
      ...rows[0],
      signalCount: signalCountRow?.count ?? 0,
    });
  } catch (error) {
    console.error("Failed to fetch AI preferences:", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to fetch preferences"
    );
  }
}

export async function PATCH(request: Request) {
  const client = await requireRouteClient();
  if ("response" in client) return client.response;

  try {
    const body = await request.json();
    const parsed = aiPreferencesSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { detail: "Validation failed", errors: parsed.error.format() },
        { status: 400 }
      );
    }

    const { consultationTypes, focusAreas, excludedTopics } = parsed.data;

    // Fetch current values for audit diff
    const current = await db
      .select()
      .from(userAIPreferences)
      .where(eq(userAIPreferences.userId, client.userId))
      .limit(1);

    const oldValues = current[0] ?? null;

    const [updated] = await db
      .insert(userAIPreferences)
      .values({
        userId: client.userId,
        consultationTypes,
        focusAreas,
        excludedTopics,
      })
      .onConflictDoUpdate({
        target: userAIPreferences.userId,
        set: {
          consultationTypes,
          focusAreas,
          excludedTopics,
          updatedAt: new Date(),
        },
      })
      .returning();

    await emitAuditEvent({
      action: "updated_ai_preferences",
      entityType: "user_ai_preferences",
      entityId: client.userId,
      metadata: {
        old: oldValues
          ? {
              consultationTypes: oldValues.consultationTypes,
              focusAreas: oldValues.focusAreas,
              excludedTopics: oldValues.excludedTopics,
            }
          : null,
        new: { consultationTypes, focusAreas, excludedTopics },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update AI preferences:", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to update preferences"
    );
  }
}
