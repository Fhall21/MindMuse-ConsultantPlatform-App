import { NextResponse } from "next/server";
import { listPeopleForUser } from "@/lib/data/domain-read";
import { jsonError, requireRouteClient } from "../_helpers";

export async function GET() {
  const client = await requireRouteClient();
  if ("response" in client) {
    return client.response;
  }

  try {
    const people = await listPeopleForUser(client.userId);
    return NextResponse.json(people);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to load people");
  }
}
