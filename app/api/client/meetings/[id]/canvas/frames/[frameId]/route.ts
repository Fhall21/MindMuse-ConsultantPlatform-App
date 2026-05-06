import { NextResponse } from "next/server";
import { deleteCanvasFrame, updateCanvasFrame } from "@/lib/data/canvas";
import { parseFrameUpdateBody } from "@/lib/canvas-frame-validation";
import { jsonError, requireRouteClient } from "../../../../../_helpers";
import { requireOwnedMeeting } from "@/lib/data/ownership";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; frameId: string }> }
) {
  const { id: meetingId, frameId } = await params;
  const client = await requireRouteClient();
  if ("response" in client) return client.response;

  try {
    const meeting = await requireOwnedMeeting(meetingId, client.userId);
    const consultationId = meeting.consultationId;
    if (!consultationId) return jsonError("Meeting has no active consultation", 400);

    const body = await request.json();
    const parsed = parseFrameUpdateBody(body);
    if (!parsed.ok) return jsonError(parsed.error, 400);

    const frame = await updateCanvasFrame(consultationId, client.userId, frameId, parsed.updates);
    return NextResponse.json(frame);
  } catch (error) {
    console.error("[meetings/canvas/frames/[frameId]/PATCH]", error);
    return jsonError(error instanceof Error ? error.message : "Failed to update frame");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; frameId: string }> }
) {
  const { id: meetingId, frameId } = await params;
  const client = await requireRouteClient();
  if ("response" in client) return client.response;

  try {
    const meeting = await requireOwnedMeeting(meetingId, client.userId);
    const consultationId = meeting.consultationId;
    if (!consultationId) return jsonError("Meeting has no active consultation", 400);

    await deleteCanvasFrame(consultationId, client.userId, frameId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[meetings/canvas/frames/[frameId]/DELETE]", error);
    return jsonError(error instanceof Error ? error.message : "Failed to delete frame");
  }
}
