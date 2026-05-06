import { NextResponse } from "next/server";
import { createCanvasFrame, listCanvasFrames } from "@/lib/data/canvas";
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
    const { name, node_ids, viewport, position } = body;

    if (
      !name ||
      typeof name !== "string" ||
      !Array.isArray(node_ids) ||
      !viewport ||
      typeof viewport.x !== "number" ||
      typeof viewport.y !== "number" ||
      typeof viewport.zoom !== "number"
    ) {
      return jsonError("Missing or invalid fields: name, node_ids, viewport", 400);
    }

    const frame = await createCanvasFrame(consultationId, client.userId, {
      name,
      nodeIds: node_ids as string[],
      viewport,
      position: typeof position === "number" ? position : 0,
    });

    return NextResponse.json(frame, { status: 201 });
  } catch (error) {
    console.error("[meetings/canvas/frames/POST]", error);
    return jsonError(error instanceof Error ? error.message : "Failed to create frame");
  }
}
