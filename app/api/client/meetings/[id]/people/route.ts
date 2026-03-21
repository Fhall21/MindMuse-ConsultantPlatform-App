import { NextResponse } from "next/server";
import { listPeopleForConsultation } from "@/lib/data/domain-read";
import { jsonError, requireRouteClient } from "../../../_helpers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const client = await requireRouteClient();
  if ("response" in client) {
    return client.response;
  }

  try {
    const people = await listPeopleForConsultation(id, client.userId);
    return NextResponse.json(people);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to load meeting people");
  }
}
