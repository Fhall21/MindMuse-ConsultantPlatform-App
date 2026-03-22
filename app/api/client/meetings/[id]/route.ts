import { NextResponse } from "next/server";
import {
  getLatestEvidenceEmailForMeeting,
  getMeetingForUser,
  listInsightsForMeeting,
  listMeetingPersonLinks,
} from "@/lib/data/domain-read";
import { archiveMeeting, restoreMeeting } from "@/lib/actions/consultations";
import { jsonError, requireRouteClient } from "../../_helpers";

function logOptionalMeetingLoadFailure(
  label: string,
  meetingId: string,
  error: unknown
) {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`[meeting-detail] failed to load ${label} for ${meetingId}: ${detail}`);
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
    const meeting = await getMeetingForUser(id, client.userId);

    if (!meeting) {
      return jsonError("Meeting not found", 404);
    }

    const [themesResult, peopleResult, latestEvidenceEmailResult] = await Promise.allSettled([
      listInsightsForMeeting(id, client.userId),
      listMeetingPersonLinks(id, client.userId),
      getLatestEvidenceEmailForMeeting(id, client.userId),
    ]);

    const themes =
      themesResult.status === "fulfilled"
        ? themesResult.value
        : (logOptionalMeetingLoadFailure("themes", id, themesResult.reason), []);
    const people =
      peopleResult.status === "fulfilled"
        ? peopleResult.value
        : (logOptionalMeetingLoadFailure("people links", id, peopleResult.reason), []);
    const latestEvidenceEmail =
      latestEvidenceEmailResult.status === "fulfilled"
        ? latestEvidenceEmailResult.value
        : (logOptionalMeetingLoadFailure(
            "latest evidence email",
            id,
            latestEvidenceEmailResult.reason
          ),
          null);

    return NextResponse.json({
      meeting,
      themes,
      people,
      latestEvidenceEmail,
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to load meeting");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const client = await requireRouteClient();
  if ("response" in client) {
    return client.response;
  }

  try {
    const body = (await request.json()) as { archived?: boolean };

    if (body.archived === true) {
      await archiveMeeting(id);
    } else if (body.archived === false) {
      await restoreMeeting(id);
    } else {
      return jsonError("Invalid archive request", 400);
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to update meeting archive state");
  }
}
