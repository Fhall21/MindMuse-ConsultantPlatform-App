import { NextResponse } from "next/server";
import { listQuotesForMeeting, type QuoteStatus } from "@/lib/actions/quotes";
import { jsonError, requireRouteClient } from "../../../_helpers";

const ALLOWED_STATUSES: ReadonlyArray<QuoteStatus | "all"> = [
  "all",
  "suggested",
  "approved",
  "rejected",
];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  const { meetingId } = await params;
  const client = await requireRouteClient();
  if ("response" in client) {
    return client.response;
  }

  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status") ?? "all";
  const status = ALLOWED_STATUSES.includes(statusParam as QuoteStatus | "all")
    ? (statusParam as QuoteStatus | "all")
    : "all";

  try {
    const quotes = await listQuotesForMeeting(meetingId, { status });
    return NextResponse.json(quotes);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`[quotes] failed to load quotes for meeting ${meetingId}: ${detail}`);
    return jsonError(detail);
  }
}
