"use server";

import { and, eq, count } from "drizzle-orm";
import { db } from "@/db/client";
import { meetingTypes, meetings } from "@/db/schema";
import { requireCurrentUserId } from "@/lib/data/auth-context";
import { AUDIT_ACTIONS } from "./audit-actions";
import { emitAuditEvent } from "./audit";

const DEFAULT_MEETING_TYPES = [
  { label: "1-1 Interview", code: "1-1" },
  { label: "Focus Group", code: "FC" },
] as const;

async function ensureDefaultMeetingTypes(userId: string) {
  const [{ value: existing }] = await db
    .select({ value: count() })
    .from(meetingTypes)
    .where(eq(meetingTypes.userId, userId));

  if (existing === 0) {
    await db.insert(meetingTypes).values(
      DEFAULT_MEETING_TYPES.map((t) => ({
        userId,
        label: t.label,
        code: t.code,
        isActive: true,
      }))
    );
  }
}

export async function listMeetingTypes() {
  const userId = await requireCurrentUserId();
  await ensureDefaultMeetingTypes(userId);

  return db
    .select()
    .from(meetingTypes)
    .where(and(eq(meetingTypes.userId, userId), eq(meetingTypes.isActive, true)))
    .orderBy(meetingTypes.label);
}

export async function listAllMeetingTypes() {
  const userId = await requireCurrentUserId();
  await ensureDefaultMeetingTypes(userId);

  return db
    .select()
    .from(meetingTypes)
    .where(eq(meetingTypes.userId, userId))
    .orderBy(meetingTypes.label);
}

interface CreateMeetingTypeParams {
  label: string;
  code: string;
}

export async function createMeetingType({ label, code }: CreateMeetingTypeParams) {
  const userId = await requireCurrentUserId();

  const trimmedLabel = label.trim();
  const trimmedCode = code.trim().toUpperCase();

  if (!trimmedLabel) throw new Error("Label is required");
  if (!trimmedCode) throw new Error("Code is required");
  if (trimmedCode.length > 10) throw new Error("Code must be 10 characters or fewer");

  const [created] = await db
    .insert(meetingTypes)
    .values({ userId, label: trimmedLabel, code: trimmedCode, isActive: true })
    .returning();

  await emitAuditEvent({
    action: AUDIT_ACTIONS.MEETING_TYPE_CREATED,
    entityType: "meeting_type",
    entityId: created.id,
    metadata: { label: trimmedLabel, code: trimmedCode },
  });

  return created;
}

interface UpdateMeetingTypeParams {
  id: string;
  label?: string;
  code?: string;
}

export async function updateMeetingType({ id, label, code }: UpdateMeetingTypeParams) {
  const userId = await requireCurrentUserId();

  const [existing] = await db
    .select()
    .from(meetingTypes)
    .where(and(eq(meetingTypes.id, id), eq(meetingTypes.userId, userId)))
    .limit(1);

  if (!existing) throw new Error("Meeting type not found");

  const updates: Partial<typeof meetingTypes.$inferInsert> = {};
  if (label !== undefined) {
    const trimmed = label.trim();
    if (!trimmed) throw new Error("Label is required");
    updates.label = trimmed;
  }
  if (code !== undefined) {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) throw new Error("Code is required");
    if (trimmed.length > 10) throw new Error("Code must be 10 characters or fewer");
    updates.code = trimmed;
  }

  if (Object.keys(updates).length === 0) return existing;

  const [updated] = await db
    .update(meetingTypes)
    .set(updates)
    .where(and(eq(meetingTypes.id, id), eq(meetingTypes.userId, userId)))
    .returning();

  await emitAuditEvent({
    action: AUDIT_ACTIONS.MEETING_TYPE_UPDATED,
    entityType: "meeting_type",
    entityId: id,
    metadata: updates as Record<string, unknown>,
  });

  return updated;
}

export async function archiveMeetingType(id: string) {
  const userId = await requireCurrentUserId();

  const [existing] = await db
    .select()
    .from(meetingTypes)
    .where(and(eq(meetingTypes.id, id), eq(meetingTypes.userId, userId)))
    .limit(1);

  if (!existing) throw new Error("Meeting type not found");

  await db
    .update(meetingTypes)
    .set({ isActive: false })
    .where(and(eq(meetingTypes.id, id), eq(meetingTypes.userId, userId)));

  await emitAuditEvent({
    action: AUDIT_ACTIONS.MEETING_TYPE_ARCHIVED,
    entityType: "meeting_type",
    entityId: id,
    metadata: { label: existing.label, code: existing.code },
  });
}

export async function deleteMeetingType(id: string) {
  const userId = await requireCurrentUserId();

  const [existing] = await db
    .select()
    .from(meetingTypes)
    .where(and(eq(meetingTypes.id, id), eq(meetingTypes.userId, userId)))
    .limit(1);

  if (!existing) throw new Error("Meeting type not found");

  const [{ value: usageCount }] = await db
    .select({ value: count() })
    .from(meetings)
    .where(and(eq(meetings.meetingTypeId, id), eq(meetings.userId, userId)));

  if (usageCount > 0) {
    throw new Error(
      `Cannot delete: ${usageCount} meeting(s) still reference this type. Archive it instead.`
    );
  }

  await db
    .delete(meetingTypes)
    .where(and(eq(meetingTypes.id, id), eq(meetingTypes.userId, userId)));

  await emitAuditEvent({
    action: AUDIT_ACTIONS.MEETING_TYPE_DELETED,
    entityType: "meeting_type",
    entityId: id,
    metadata: { label: existing.label, code: existing.code },
  });
}
