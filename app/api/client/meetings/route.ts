import { NextResponse } from "next/server";
import { listMeetingsForUser } from "@/lib/data/domain-read";
import { jsonError, requireRouteClient } from "../_helpers";

export async function GET(request: Request) {
  const client = await requireRouteClient();
  if ("response" in client) {
    return client.response;
  }

  try {
    const url = new URL(request.url);
    const includeArchived = url.searchParams.get("archived") === "true";
    const meetings = await listMeetingsForUser(client.userId, { includeArchived });
    return NextResponse.json(meetings);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to load meetings");
  }
}
