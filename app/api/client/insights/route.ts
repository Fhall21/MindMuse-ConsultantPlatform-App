import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { insights } from "@/db/schema";
import { requireOwnedMeeting } from "@/lib/data/ownership";
import { insertAuditLogEntry } from "@/lib/data/audit-log";
import { jsonError, requireRouteClient } from "../_helpers";

const createSchema = z.object({
  meeting_id: z.string().uuid(),
  label: z.string().min(1).max(500),
  description: z.string().optional(),
});

export async function POST(request: Request) {
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

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid payload", 422);
  }

  try {
    const meeting = await requireOwnedMeeting(parsed.data.meeting_id, client.userId);

    const [row] = await db
      .insert(insights)
      .values({
        meetingId: meeting.id,
        label: parsed.data.label,
        description: parsed.data.description ?? null,
        accepted: true,
        isUserAdded: true,
      })
      .returning({ id: insights.id, label: insights.label });

    await insertAuditLogEntry({
      userId: client.userId,
      consultationId: meeting.id,
      action: "insight.created",
      entityType: "insight",
      entityId: row?.id,
      metadata: { label: parsed.data.label, source: "chat" },
    });

    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to create insight");
  }
}
