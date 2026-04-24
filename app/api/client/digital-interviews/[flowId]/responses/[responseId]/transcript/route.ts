import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireRouteClient } from "../../../../../_helpers";
import { getDigitalInterviewResponseTranscript } from "@/lib/data/digital-interviews";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ flowId: string; responseId: string }> }
) {
  const client = await requireRouteClient();
  if ("response" in client) return client.response;

  try {
    const { flowId, responseId } = await params;
    const response = await getDigitalInterviewResponseTranscript(flowId, responseId, client.userId);

    if (!response) {
      return jsonError("Response not found", 404);
    }

    return NextResponse.json({ data: response });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to load transcript");
  }
}
