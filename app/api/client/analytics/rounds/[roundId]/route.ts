import { NextResponse } from "next/server";
import { getRoundAnalyticsDataSet } from "@/lib/actions/analytics";
import { analyticsRouteError } from "../../_helpers";
import { requireRouteClient } from "../../../_helpers";

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
    const data = await getRoundAnalyticsDataSet(roundId);
    return NextResponse.json({ data });
  } catch (error) {
    return analyticsRouteError(error, "Failed to load round analytics");
  }
}
