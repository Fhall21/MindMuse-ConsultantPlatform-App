import { NextResponse } from "next/server";
import {
  getMeetingForUser,
  listEvidenceEmailsForMeeting,
} from "@/lib/data/domain-read";
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
    const consultation = await getMeetingForUser(consultationId, client.userId);

    if (!consultation) {
      return jsonError("Consultation not found", 404);
    }

    const evidenceEmails = await listEvidenceEmailsForMeeting(
      consultationId,
      client.userId
    );
    return NextResponse.json(evidenceEmails);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(
      `[consultation-evidence-emails] failed to load evidence emails for ${consultationId}: ${detail}`
    );
    return NextResponse.json([]);
  }
}
