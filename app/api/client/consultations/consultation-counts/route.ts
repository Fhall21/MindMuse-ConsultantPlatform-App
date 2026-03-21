import { NextResponse } from "next/server";
import { countConsultationsByRoundIds } from "@/lib/data/domain-read";
import { jsonError, requireRouteClient } from "../../_helpers";

export async function POST(request: Request) {
  const client = await requireRouteClient();
  if ("response" in client) {
    return client.response;
  }

  const { ids } = (await request.json()) as { ids?: string[] };
  const consultationIds = Array.isArray(ids) ? ids.filter(Boolean) : [];

  if (consultationIds.length === 0) {
    return NextResponse.json({});
  }

  try {
    const counts = await countConsultationsByRoundIds(consultationIds, client.userId);
    return NextResponse.json(counts);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to load round consultation counts"
    );
  }
}
