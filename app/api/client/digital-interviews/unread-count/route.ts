import { NextResponse } from "next/server";
import { countUnreadDigitalInterviewCompletionsForUser } from "@/lib/data/digital-interviews";
import { jsonError, requireRouteClient } from "../../_helpers";

export async function GET() {
  const client = await requireRouteClient();
  if ("response" in client) {
    return client.response;
  }

  try {
    const unreadCount = await countUnreadDigitalInterviewCompletionsForUser(client.userId);
    return NextResponse.json(unreadCount);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to load digital interview unread count"
    );
  }
}