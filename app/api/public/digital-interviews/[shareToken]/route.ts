import { NextRequest, NextResponse } from "next/server";
import { getPublicDigitalInterviewFlow } from "@/lib/data/digital-interviews";
import { jsonError } from "@/app/api/client/_helpers";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ shareToken: string }> }
) {
  try {
    const { shareToken } = await params;
    const flow = await getPublicDigitalInterviewFlow(shareToken);

    if (!flow) {
      return jsonError("Digital interview not found", 404);
    }

    return NextResponse.json({ data: flow });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to load digital interview");
  }
}
