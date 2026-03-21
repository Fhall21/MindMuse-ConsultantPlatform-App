import { NextResponse } from "next/server";
import {
  getRoundAnalyticsJobStatuses,
  triggerRoundAnalyticsJobs,
} from "@/lib/actions/analytics";
import { analyticsRouteError } from "../../../_helpers";
import { requireRouteClient } from "../../../../_helpers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roundId: string }> }
) {
  const { roundId } = await params;
  const client = await requireRouteClient();
  if ("response" in client) {
    return client.response;
  }

  try {
    const data = await getRoundAnalyticsJobStatuses(roundId);
    return NextResponse.json(data);
  } catch (error) {
    console.error("[analytics/rounds/jobs GET] error", {
      roundId,
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return analyticsRouteError(error, "Failed to load round analytics job statuses");
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ roundId: string }> }
) {
  const { roundId } = await params;
  const client = await requireRouteClient();
  if ("response" in client) {
    return client.response;
  }

  try {
    const data = await triggerRoundAnalyticsJobs(roundId);
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return analyticsRouteError(error, "Failed to trigger round analytics jobs");
  }
}
