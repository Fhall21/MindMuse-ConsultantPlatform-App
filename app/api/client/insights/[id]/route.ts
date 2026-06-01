import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { insights, meetings } from "@/db/schema";
import { insertAuditLogEntry } from "@/lib/data/audit-log";
import { jsonError, requireRouteClient } from "../../_helpers";

const patchSchema = z.object({
  label: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const client = await requireRouteClient();
  if ("response" in client) {
    return client.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON", 422);
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid payload", 422);
  }

  try {
    const [insight] = await db
      .select({ id: insights.id, meetingId: insights.meetingId, label: insights.label })
      .from(insights)
      .innerJoin(meetings, and(eq(meetings.id, insights.meetingId), eq(meetings.userId, client.userId)))
      .where(eq(insights.id, id))
      .limit(1);

    if (!insight) {
      return jsonError("This theme has been deleted or is no longer accessible.", 404);
    }

    const updates: { label?: string; description?: string | null } = {};
    if (parsed.data.label !== undefined) updates.label = parsed.data.label;
    if (parsed.data.description !== undefined) updates.description = parsed.data.description;

    if (Object.keys(updates).length > 0) {
      await db.update(insights).set(updates).where(eq(insights.id, id));
    }

    await insertAuditLogEntry({
      userId: client.userId,
      consultationId: insight.meetingId ?? undefined,
      action: "insight.updated",
      entityType: "insight",
      entityId: id,
      metadata: { changes: updates, source: "chat" },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to update theme");
  }
}
