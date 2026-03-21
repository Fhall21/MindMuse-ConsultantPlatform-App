import { NextResponse } from "next/server";
import { triggerConsultationAnalyticsJob, getConsultationAnalyticsJobStatus } from "@/lib/actions/analytics";
import { analyticsRouteError } from "../../../_helpers";
import { requireRouteClient } from "../../../../_helpers";

async function readTextBody(request: Request) {
  const bodyText = await request.text();
  if (!bodyText.trim()) {
    return {};
  }

  try {
    return JSON.parse(bodyText) as unknown;
  } catch {
    throw new Error("Invalid JSON payload");
  }
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
    const data = await getConsultationAnalyticsJobStatus(id);
    return NextResponse.json({ data });
  } catch (error) {
    return analyticsRouteError(error, "Failed to load consultation analytics job status");
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const client = await requireRouteClient();
  if ("response" in client) {
    return client.response;
  }

  try {
    const body = await readTextBody(request);
    const roundId =
      typeof body === "object" && body !== null && "roundId" in body && typeof (body as { roundId?: unknown }).roundId === "string"
        ? (body as { roundId: string }).roundId
        : null;

    const data = await triggerConsultationAnalyticsJob(id, roundId);
    return NextResponse.json(data, { status: data.status === "queued" ? 201 : 200 });
  } catch (error) {
    return analyticsRouteError(error, "Failed to trigger consultation analytics job");
  }
}
