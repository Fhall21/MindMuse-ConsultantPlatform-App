import { NextResponse } from "next/server";
import {
  getConsultationForUser,
  getLatestEvidenceEmailForConsultation,
  listConsultationPersonLinks,
  listThemesForConsultation,
} from "@/lib/data/domain-read";
import { jsonError, requireRouteClient } from "../../_helpers";

function logOptionalConsultationLoadFailure(
  label: string,
  consultationId: string,
  error: unknown
) {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`[consultation-detail] failed to load ${label} for ${consultationId}: ${detail}`);
}

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
    const consultation = await getConsultationForUser(id, client.userId);

    if (!consultation) {
      return jsonError("Consultation not found", 404);
    }

    const [themesResult, peopleResult, latestEvidenceEmailResult] = await Promise.allSettled([
      listThemesForConsultation(id, client.userId),
      listConsultationPersonLinks(id, client.userId),
      getLatestEvidenceEmailForConsultation(id, client.userId),
    ]);

    const themes =
      themesResult.status === "fulfilled"
        ? themesResult.value
        : (logOptionalConsultationLoadFailure("themes", id, themesResult.reason), []);
    const people =
      peopleResult.status === "fulfilled"
        ? peopleResult.value
        : (logOptionalConsultationLoadFailure("people links", id, peopleResult.reason), []);
    const latestEvidenceEmail =
      latestEvidenceEmailResult.status === "fulfilled"
        ? latestEvidenceEmailResult.value
        : (logOptionalConsultationLoadFailure(
            "latest evidence email",
            id,
            latestEvidenceEmailResult.reason
          ),
          null);

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
