import { NextRequest, NextResponse } from "next/server";
import {
  createOrResumeDigitalInterviewSession,
  digitalInterviewSessionCreateSchema,
} from "@/lib/data/digital-interviews";
import { parseJsonBodyOrResponse } from "@/lib/api/route-helpers";
import { jsonError } from "@/app/api/client/_helpers";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ shareToken: string }> }
) {
  try {
    const body = await parseJsonBodyOrResponse(request);
    if (body instanceof NextResponse) {
      return body;
    }

    const parsed = digitalInterviewSessionCreateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid digital interview payload", 422);
    }

    const { shareToken } = await params;
    const session = await createOrResumeDigitalInterviewSession(shareToken, parsed.data);

    if (!session) {
      return jsonError("Digital interview not found", 404);
    }

    return NextResponse.json({ data: session });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to open digital interview session");
  }
}
