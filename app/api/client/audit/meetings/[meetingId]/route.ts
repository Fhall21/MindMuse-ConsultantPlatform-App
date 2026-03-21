import { NextResponse } from "next/server";
import { listAuditEventsForMeeting } from "@/lib/data/domain-read";
import { jsonError, requireRouteClient } from "../../../_helpers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  const { meetingId } = await params;
  const client = await requireRouteClient();
  if ("response" in client) {
    return client.response;
  }

  try {
    const auditEvents = await listAuditEventsForMeeting(meetingId, client.userId);
    return NextResponse.json(auditEvents);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to load audit events");
  }
}