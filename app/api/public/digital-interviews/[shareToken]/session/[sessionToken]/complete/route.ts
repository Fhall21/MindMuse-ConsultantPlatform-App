import { NextRequest, NextResponse } from "next/server";
import { completeDigitalInterviewSession } from "@/lib/data/digital-interviews";
import { jsonError } from "@/app/api/client/_helpers";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ shareToken: string; sessionToken: string }> }
) {
  try {
    const { shareToken, sessionToken } = await params;
    const session = await completeDigitalInterviewSession({ shareToken, sessionToken });

    if (!session) {
      return jsonError("Digital interview session not found", 404);
    }

    return NextResponse.json({ data: session });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to complete digital interview session");
  }
}
