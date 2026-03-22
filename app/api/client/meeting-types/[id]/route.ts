import { NextRequest, NextResponse } from "next/server";
import {
  updateMeetingType,
  archiveMeetingType,
  deleteMeetingType,
} from "@/lib/actions/meeting-types";
import { jsonError, requireRouteClient } from "../../_helpers";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const client = await requireRouteClient();
  if ("response" in client) return client.response;

  try {
    const { id } = await params;
    const body = (await request.json()) as { label?: string; code?: string };
    const updated = await updateMeetingType({ id, ...body });
    return NextResponse.json(updated);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to update meeting type");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const client = await requireRouteClient();
  if ("response" in client) return client.response;

  try {
    const { id } = await params;
    const url = new URL(request.url);
    const force = url.searchParams.get("force") === "true";

    if (force) {
      await deleteMeetingType(id);
    } else {
      await archiveMeetingType(id);
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to delete meeting type");
  }
}
