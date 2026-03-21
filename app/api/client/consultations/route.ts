import { NextResponse } from "next/server";
import { listRoundsForUser } from "@/lib/data/domain-read";
import { jsonError, requireRouteClient } from "../_helpers";

export async function GET() {
  const client = await requireRouteClient();
  if ("response" in client) {
    return client.response;
  }

  try {
    const rounds = await listRoundsForUser(client.userId);
    return NextResponse.json(rounds);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to load rounds");
  }
}
