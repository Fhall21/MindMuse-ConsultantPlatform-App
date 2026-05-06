import { NextResponse } from "next/server";
import { createCanvasFrame, listCanvasFrames } from "@/lib/data/canvas";
import { parseFrameCreateBody } from "@/lib/canvas-frame-validation";
import { jsonError, requireRouteClient } from "../../../../_helpers";
import { requireOwnedMeeting } from "@/lib/data/ownership";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: meetingId } = await params;
  const client = await requireRouteClient();
  if ("response" in client) return client.response;

  try {
    const meeting = await requireOwnedMeeting(meetingId, client.userId);
    const consultationId = meeting.consultationId;
    if (!consultationId) return jsonError("Meeting has no active consultation", 400);

    const frames = await listCanvasFrames(consultationId, client.userId);
    return NextResponse.json(frames);
  } catch (error) {
    console.error("[meetings/canvas/frames/GET]", error);
    return jsonError(error instanceof Error ? error.message : "Failed to list frames");
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: meetingId } = await params;
  const client = await requireRouteClient();
  if ("response" in client) return client.response;

  try {
    const meeting = await requireOwnedMeeting(meetingId, client.userId);
    const consultationId = meeting.consultationId;
    if (!consultationId) return jsonError("Meeting has no active consultation", 400);

    const body = await request.json();
    const parsed = parseFrameCreateBody(body);
    if (!parsed.ok) return jsonError(parsed.error, 400);

    const frame = await createCanvasFrame(consultationId, client.userId, parsed.payload);
    return NextResponse.json(frame, { status: 201 });
  } catch (error) {
    console.error("[meetings/canvas/frames/POST]", error);
    return jsonError(error instanceof Error ? error.message : "Failed to create frame");
  }
}
