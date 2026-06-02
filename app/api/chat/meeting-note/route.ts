import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { requireAuthenticatedApiUser } from "@/lib/api/route-helpers";
import { db } from "@/db/client";
import {
  auditLog,
  chatMessages,
  chatSessions,
  chatToolResults,
  meetings,
} from "@/db/schema";
import { getCardConfirmationMessage } from "@/lib/chat/card-confirmation-copy";
import { readMeetingNoteProposal } from "@/lib/chat/tools/nl-actions";

const requestSchema = z.object({
  sessionId: z.string().uuid(),
  toolResultId: z.string().uuid(),
  note: z.string().trim().min(1).max(5000),
});

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedApiUser();
  if (auth instanceof NextResponse) return auth;

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ detail: "Invalid meeting note request" }, { status: 422 });
  }

  const completed = await db.transaction(async (tx) => {
    const [ownedToolResult] = await tx
      .select({ id: chatToolResults.id, output: chatToolResults.output })
      .from(chatToolResults)
      .innerJoin(chatSessions, eq(chatSessions.id, chatToolResults.sessionId))
      .where(
        and(
          eq(chatToolResults.id, parsed.data.toolResultId),
          eq(chatToolResults.sessionId, parsed.data.sessionId),
          eq(chatToolResults.toolName, "attach_meeting_note"),
          eq(chatToolResults.status, "pending"),
          eq(chatSessions.userId, auth.id),
          isNull(chatSessions.archivedAt)
        )
      )
      .limit(1);

    const proposal = readMeetingNoteProposal(ownedToolResult?.output);
    if (!proposal) return false;

    const [meeting] = await tx
      .select({ id: meetings.id, title: meetings.title, notes: meetings.notes })
      .from(meetings)
      .where(and(eq(meetings.id, proposal.meeting_id), eq(meetings.userId, auth.id)))
      .limit(1);

    if (!meeting) return false;

    const existingNotes = meeting.notes?.trim();
    const notes = existingNotes ? `${existingNotes}\n\n${parsed.data.note}` : parsed.data.note;

    await tx
      .update(meetings)
      .set({ notes, updatedAt: new Date() })
      .where(and(eq(meetings.id, meeting.id), eq(meetings.userId, auth.id)));

    await tx.insert(auditLog).values({
      meetingId: meeting.id,
      action: "meeting_note_attached",
      entityType: "meeting",
      entityId: meeting.id,
      payload: { note: parsed.data.note },
      userId: auth.id,
    });

    await tx
      .update(chatToolResults)
      .set({
        status: "success",
        output: {
          meeting_id: meeting.id,
          meeting_title: meeting.title,
          note: parsed.data.note,
        },
      })
      .where(
        and(
          eq(chatToolResults.id, parsed.data.toolResultId),
          eq(chatToolResults.sessionId, parsed.data.sessionId)
        )
      );

    await tx.insert(chatMessages).values({
      sessionId: parsed.data.sessionId,
      role: "assistant",
      content: getCardConfirmationMessage("meeting_note_attached"),
    });

    await tx
      .update(chatSessions)
      .set({ updatedAt: new Date() })
      .where(eq(chatSessions.id, parsed.data.sessionId));

    return true;
  });

  if (!completed) {
    return NextResponse.json({ detail: "Meeting note card not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
