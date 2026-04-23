import { NextRequest, NextResponse } from "next/server";
import {
  createDigitalInterviewFlow,
  digitalInterviewFlowCreateSchema,
  listDigitalInterviewFlowsForUser,
} from "@/lib/data/digital-interviews";
import { jsonError, requireRouteClient } from "../_helpers";

export async function GET() {
  const client = await requireRouteClient();
  if ("response" in client) {
    return client.response;
  }

  try {
    const flows = await listDigitalInterviewFlowsForUser(client.userId);
    return NextResponse.json({ data: flows });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to load digital interviews");
  }
}

export async function POST(request: NextRequest) {
  const client = await requireRouteClient();
  if ("response" in client) {
    return client.response;
  }

  try {
    const body = await request.json();
    const parsed = digitalInterviewFlowCreateSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid digital interview payload", 422);
    }

    const flow = await createDigitalInterviewFlow(client.userId, parsed.data);
    return NextResponse.json({ data: flow }, { status: 201 });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to create digital interview");
  }
}
