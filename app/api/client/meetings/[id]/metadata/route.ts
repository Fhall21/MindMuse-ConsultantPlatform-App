import { NextResponse } from "next/server";
import { z } from "zod";
import { updateMeetingTitle, updateMeetingFields } from "@/lib/actions/consultations";
import { jsonError, requireRouteClient } from "../../../_helpers";

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  meeting_date: z.string().optional(),
  meeting_type_id: z.string().uuid().optional(),
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
    if (parsed.data.title !== undefined) {
      await updateMeetingTitle({ id, title: parsed.data.title });
    }

    if (parsed.data.meeting_date !== undefined || parsed.data.meeting_type_id !== undefined) {
      await updateMeetingFields({
        id,
        meetingDate: parsed.data.meeting_date ? new Date(parsed.data.meeting_date) : undefined,
        meetingTypeId: parsed.data.meeting_type_id,
      });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to update meeting");
  }
}
