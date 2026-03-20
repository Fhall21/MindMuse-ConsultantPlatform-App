import { NextResponse } from "next/server";
import { listInsightsForConsultations } from "@/lib/data/domain-read";
import { jsonError, requireRouteClient } from "../../_helpers";

export async function GET(request: Request) {
  const client = await requireRouteClient();
  if ("response" in client) {
    return client.response;
  }

  const { searchParams } = new URL(request.url);
  const consultationIds = searchParams.getAll("consultationId").filter(Boolean);

  if (consultationIds.length === 0) {
    return NextResponse.json([]);
  }

  try {
    const themes = await listInsightsForConsultations(
      consultationIds,
      client.userId
    );
    return NextResponse.json(themes);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to load themes");
  }
}
