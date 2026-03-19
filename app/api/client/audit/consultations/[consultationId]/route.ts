import { NextResponse } from "next/server";
import { listAuditEventsForConsultation } from "@/lib/data/domain-read";
import { jsonError, requireRouteClient } from "../../../_helpers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ consultationId: string }> }
) {
  const { consultationId } = await params;
  const client = await requireRouteClient();
  if ("response" in client) {
    return client.response;
  }

  try {
    const auditEvents = await listAuditEventsForConsultation(
      consultationId,
      client.userId
    );
    return NextResponse.json(auditEvents);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to load audit events");
  }
}
