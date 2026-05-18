import { NextResponse } from "next/server";
import { jsonError, requireRouteClient } from "../../../../_helpers";
import { placeResearchInsightSchema } from "@/lib/validations/research-insight";
import {
  ResearchInsightNotFoundError,
  placeResearchInsightOnCanvas,
  removeResearchInsightFromCanvas,
} from "@/lib/actions/research-insights";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ insightId: string }> }
) {
  const auth = await requireRouteClient();
  if ("response" in auth) return auth.response;

  const { insightId } = await params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = placeResearchInsightSchema.safeParse({
    ...(typeof json === "object" && json !== null ? json : {}),
    insightId,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { detail: "Invalid request", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const result = await placeResearchInsightOnCanvas(auth.userId, parsed.data);
    return NextResponse.json({ placement: result.placement }, { status: 201 });
  } catch (error) {
    if (error instanceof ResearchInsightNotFoundError) {
      return jsonError("Research insight not found", 404);
    }
    if (error instanceof Error && error.message === "Consultation not found") {
      return jsonError("Consultation not found", 404);
    }
    console.error("research-insight place failed", error);
    return jsonError("Could not place research insight", 500);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ insightId: string }> }
) {
  const auth = await requireRouteClient();
  if ("response" in auth) return auth.response;

  const { insightId } = await params;
  const { searchParams } = new URL(request.url);
  const consultationId = searchParams.get("consultationId");

  if (!consultationId) {
    return jsonError("consultationId query param required", 400);
  }

  try {
    await removeResearchInsightFromCanvas(auth.userId, consultationId, insightId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ResearchInsightNotFoundError) {
      return jsonError("Research insight not found", 404);
    }
    if (error instanceof Error && error.message === "Consultation not found") {
      return jsonError("Consultation not found", 404);
    }
    console.error("research-insight remove failed", error);
    return jsonError("Could not remove research insight", 500);
  }
}
