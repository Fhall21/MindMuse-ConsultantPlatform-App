import { NextResponse } from "next/server";
import { listEvidenceEmailsForConsultation } from "@/lib/data/domain-read";
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
    const evidenceEmails = await listEvidenceEmailsForConsultation(
      consultationId,
      client.userId
    );
    return NextResponse.json(evidenceEmails);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to load evidence emails"
    );
  }
}
