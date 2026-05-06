import { NextResponse } from "next/server";
import { createCanvasFrame, listCanvasFrames } from "@/lib/data/canvas";
import { parseFrameCreateBody } from "@/lib/canvas-frame-validation";
import { jsonError, requireRouteClient } from "../../../../_helpers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roundId: string }> }
) {
  const { roundId } = await params;
  const client = await requireRouteClient();
  if ("response" in client) return client.response;

  try {
    const frames = await listCanvasFrames(roundId, client.userId);
    return NextResponse.json(frames);
  } catch (error) {
    console.error("[rounds/canvas/frames/GET]", error);
    return jsonError(error instanceof Error ? error.message : "Failed to list frames");
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roundId: string }> }
) {
  const { roundId } = await params;
  const client = await requireRouteClient();
  if ("response" in client) return client.response;

  try {
    const body = await request.json();
    const parsed = parseFrameCreateBody(body);
    if (!parsed.ok) return jsonError(parsed.error, 400);

    const frame = await createCanvasFrame(roundId, client.userId, parsed.payload);
    return NextResponse.json(frame, { status: 201 });
  } catch (error) {
    console.error("[rounds/canvas/frames/POST]", error);
    return jsonError(error instanceof Error ? error.message : "Failed to create frame");
  }
}
