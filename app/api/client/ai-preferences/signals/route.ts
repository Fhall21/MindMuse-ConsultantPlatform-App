import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { insightDecisionLogs } from "@/db/schema";
import { jsonError, requireRouteClient } from "../../_helpers";

export async function GET() {
  const client = await requireRouteClient();
  if ("response" in client) return client.response;

  try {
    const signals = await db
      .select()
      .from(insightDecisionLogs)
      .where(eq(insightDecisionLogs.userId, client.userId))
      .orderBy(desc(insightDecisionLogs.createdAt))
      .limit(100);

    return NextResponse.json(signals);
  } catch (error) {
    console.error("Failed to fetch insight signals:", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to fetch signals"
    );
  }
}
