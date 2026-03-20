import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { insightDecisionLogs } from "@/db/schema";
import { jsonError, requireRouteClient } from "../../../_helpers";
import { emitAuditEvent } from "@/lib/data/audit-log";
import { signalRationaleSchema } from "@/lib/validations/ai-preferences";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const client = await requireRouteClient();
  if ("response" in client) return client.response;

  try {
    const body = await request.json();
    const parsed = signalRationaleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { detail: "Validation failed", errors: parsed.error.format() },
        { status: 400 }
      );
    }

    const [signal] = await db
      .select()
      .from(insightDecisionLogs)
      .where(
        and(
          eq(insightDecisionLogs.id, id),
          eq(insightDecisionLogs.userId, client.userId)
        )
      )
      .limit(1);

    if (!signal) {
      return NextResponse.json({ detail: "Signal not found" }, { status: 404 });
    }

    const [updated] = await db
      .update(insightDecisionLogs)
      .set({ rationale: parsed.data.rationale ?? null })
      .where(eq(insightDecisionLogs.id, id))
      .returning();

    await emitAuditEvent({
      action: "updated_insight_signal_rationale",
      entityType: "insight_decision_logs",
      entityId: id,
      metadata: {
        oldRationale: signal.rationale,
        newRationale: parsed.data.rationale ?? null,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update signal:", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to update signal"
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const client = await requireRouteClient();
  if ("response" in client) return client.response;

  try {
    const [signal] = await db
      .select()
      .from(insightDecisionLogs)
      .where(
        and(
          eq(insightDecisionLogs.id, id),
          eq(insightDecisionLogs.userId, client.userId)
        )
      )
      .limit(1);

    if (!signal) {
      return NextResponse.json({ detail: "Signal not found" }, { status: 404 });
    }

    await db
      .delete(insightDecisionLogs)
      .where(eq(insightDecisionLogs.id, id));

    await emitAuditEvent({
      action: "deleted_insight_signal",
      entityType: "insight_decision_logs",
      entityId: id,
      metadata: {
        insightLabel: signal.insightLabel,
        decisionType: signal.decisionType,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete signal:", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to delete signal"
    );
  }
}
