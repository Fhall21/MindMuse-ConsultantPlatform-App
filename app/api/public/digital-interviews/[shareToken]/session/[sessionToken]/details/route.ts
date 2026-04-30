import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateDigitalInterviewSessionDetails } from "@/lib/data/digital-interviews";
import { parseJsonBodyOrResponse } from "@/lib/api/route-helpers";
import { jsonError } from "@/app/api/client/_helpers";

const detailsPayloadSchema = z.object({
  name: z.string().trim().min(1),
  work_type: z.string().trim().min(1),
  work_group: z.string().trim().min(1),
  organisation: z.string().trim().optional().nullable(),
  email: z.string().trim().email().optional().nullable(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ shareToken: string; sessionToken: string }> }
) {
  try {
    const body = await parseJsonBodyOrResponse(request);
    if (body instanceof NextResponse) {
      return body;
    }

    const parsed = detailsPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid digital interview payload", 422);
    }

    const { shareToken, sessionToken } = await params;
    const session = await updateDigitalInterviewSessionDetails({
      shareToken,
      sessionToken,
      details: {
        name: parsed.data.name,
        workType: parsed.data.work_type,
        workGroup: parsed.data.work_group,
        organisation: parsed.data.organisation ?? null,
        email: parsed.data.email ?? null,
      },
    });

    if (!session) {
      return jsonError("Digital interview session not found", 404);
    }

    return NextResponse.json({ data: session });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to update digital interview session details");
  }
}
