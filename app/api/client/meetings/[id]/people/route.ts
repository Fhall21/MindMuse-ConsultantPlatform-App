import { NextResponse } from "next/server";
import { z } from "zod";
import { listPeopleForMeeting } from "@/lib/data/domain-read";
import { linkPersonToMeeting } from "@/lib/actions/people";
import { jsonError, requireRouteClient } from "../../../_helpers";

const linkBodySchema = z.object({
  person_id: z.string().uuid(),
});

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
    const people = await listPeopleForMeeting(id, client.userId);
    return NextResponse.json(people);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to load meeting people");
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const client = await requireRouteClient();
  if ("response" in client) {
    return client.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON", 422);
  }

  const parsed = linkBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid payload", 422);
  }

  try {
    await linkPersonToMeeting(id, parsed.data.person_id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to link person");
  }
}
