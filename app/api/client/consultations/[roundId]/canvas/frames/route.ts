import { NextResponse } from "next/server";
import { createCanvasFrame, listCanvasFrames } from "@/lib/data/canvas";
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

    const frame = await createCanvasFrame(roundId, client.userId, {
      name,
      nodeIds: node_ids as string[],
      viewport,
      position: typeof position === "number" ? position : 0,
    });

    return NextResponse.json(frame, { status: 201 });
  } catch (error) {
    console.error("[rounds/canvas/frames/POST]", error);
    return jsonError(error instanceof Error ? error.message : "Failed to create frame");
  }
}
