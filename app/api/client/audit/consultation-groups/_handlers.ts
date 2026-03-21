import { NextResponse } from "next/server";
import { listAuditEventsForRound } from "@/lib/data/domain-read";
import { jsonError, requireRouteClient } from "../../_helpers";

export async function getConsultationGroupAuditEventsResponse(consultationGroupId: string) {
  const client = await requireRouteClient();
  if ("response" in client) {
    return client.response;
  }

  try {
    const auditEvents = await listAuditEventsForRound(consultationGroupId, client.userId);
    return NextResponse.json(auditEvents);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to load consultation group audit events"
    );
  }
}