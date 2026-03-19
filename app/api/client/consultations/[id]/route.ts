import { NextResponse } from "next/server";
import {
  getConsultationForUser,
  getLatestEvidenceEmailForConsultation,
  listConsultationPersonLinks,
  listThemesForConsultation,
} from "@/lib/data/domain-read";
import { jsonError, requireRouteClient } from "../../_helpers";

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
    const [consultation, themes, people, latestEvidenceEmail] = await Promise.all([
      getConsultationForUser(id, client.userId),
      listThemesForConsultation(id, client.userId),
      listConsultationPersonLinks(id, client.userId),
      getLatestEvidenceEmailForConsultation(id, client.userId),
    ]);

    if (!consultation) {
      return jsonError("Consultation not found", 404);
    }

    return NextResponse.json({
      consultation,
      themes,
      people,
      latestEvidenceEmail,
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to load consultation");
  }
}
