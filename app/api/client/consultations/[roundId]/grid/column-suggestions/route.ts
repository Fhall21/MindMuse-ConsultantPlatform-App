import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { meetings } from "@/db/schema";
import { requireOwnedRound } from "@/lib/data/ownership";
import { getAiServiceUrl } from "@/lib/env";
import { forwardJsonToAi } from "@/lib/api/route-helpers";
import { jsonError, requireRouteClient } from "../../../../_helpers";
import { gridColumnSuggestionsResponseSchema } from "../_types";
import { gridRouteErrorStatus } from "../_errors";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roundId: string }> }
) {
  const { roundId } = await params;
  const client = await requireRouteClient();
  if ("response" in client) return client.response;

  try {
    // Validate ownership of round
    await requireOwnedRound(roundId, client.userId);

    // Fetch all transcripts for the round
    const roundMeetings = await db
      .select({ transcriptRaw: meetings.transcriptRaw })
      .from(meetings)
      .where(
        and(
          eq(meetings.consultationId, roundId),
          eq(meetings.userId, client.userId)
        )
      );

    const transcripts = roundMeetings
      .map((m) => m.transcriptRaw)
      .filter((t): t is string => !!t && t.trim().length > 0);

    if (transcripts.length === 0) {
      return NextResponse.json({ suggestions: [] });
    }

    const aiServiceUrl = getAiServiceUrl();
    const payload = { transcripts };
    const auth = { userId: client.userId };

    const response = await forwardJsonToAi(
      aiServiceUrl,
      "/grid/column-suggestions",
      payload,
      auth
    );

    if (!response.ok) return response;

    const parsed = gridColumnSuggestionsResponseSchema.safeParse(
      await response.clone().json()
    );
    if (!parsed.success) {
      return jsonError("AI service returned invalid column suggestions", 502);
    }

    return NextResponse.json(parsed.data);
  } catch (error) {
    console.error("[column-suggestions/GET] Failed to get suggestions", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to get suggestions",
      gridRouteErrorStatus(error)
    );
  }
}
