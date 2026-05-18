import { NextResponse } from "next/server";
import { jsonError, requireRouteClient } from "../../_helpers";
import { extractResearchInsightSchema } from "@/lib/validations/research-insight";
import {
  ResearchSessionNotFoundError,
  extractResearchInsight,
} from "@/lib/actions/research-insights";

export async function POST(request: Request) {
  const auth = await requireRouteClient();
  if ("response" in auth) return auth.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = extractResearchInsightSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { detail: "Invalid request", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const result = await extractResearchInsight(auth.userId, parsed.data);
    return NextResponse.json(
      {
        insight: result.insight,
        quote: result.quote,
        placement: result.placement,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ResearchSessionNotFoundError) {
      return jsonError("Source no longer available", 404);
    }
    if (error instanceof Error && error.message === "Consultation not found") {
      return jsonError("Consultation not found", 404);
    }
    console.error("research-insight extract failed", error);
    return jsonError("Could not save research insight", 500);
  }
}
