import { NextRequest, NextResponse } from "next/server";
import { listMeetingTypes, createMeetingType } from "@/lib/actions/meeting-types";
import { jsonError, requireRouteClient } from "../_helpers";

export async function GET() {
  const client = await requireRouteClient();
  if ("response" in client) return client.response;

  try {
    const types = await listMeetingTypes();
    return NextResponse.json(types);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to load meeting types");
  }
}

export async function POST(request: NextRequest) {
  const client = await requireRouteClient();
  if ("response" in client) return client.response;

  try {
    const body = (await request.json()) as { label?: string; code?: string };
    const created = await createMeetingType({
      label: body.label ?? "",
      code: body.code ?? "",
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to create meeting type");
  }
}
