import { NextResponse } from "next/server";
import { deleteCanvasFrame, updateCanvasFrame } from "@/lib/data/canvas";
import { parseFrameUpdateBody } from "@/lib/canvas-frame-validation";
import { jsonError, requireRouteClient } from "../../../../../_helpers";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ roundId: string; frameId: string }> }
) {
  const { roundId, frameId } = await params;
  const client = await requireRouteClient();
  if ("response" in client) return client.response;

  try {
    const body = await request.json();
    const parsed = parseFrameUpdateBody(body);
    if (!parsed.ok) return jsonError(parsed.error, 400);

    const frame = await updateCanvasFrame(roundId, client.userId, frameId, parsed.updates);
    return NextResponse.json(frame);
  } catch (error) {
    console.error("[rounds/canvas/frames/[frameId]/PATCH]", error);
    return jsonError(error instanceof Error ? error.message : "Failed to update frame");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ roundId: string; frameId: string }> }
) {
  const { roundId, frameId } = await params;
  const client = await requireRouteClient();
  if ("response" in client) return client.response;

  try {
    await deleteCanvasFrame(roundId, client.userId, frameId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[rounds/canvas/frames/[frameId]/DELETE]", error);
    return jsonError(error instanceof Error ? error.message : "Failed to delete frame");
  }
}
