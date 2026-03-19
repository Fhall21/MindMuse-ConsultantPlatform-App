import { NextResponse } from "next/server";
import { countConsultationsByPersonIds } from "@/lib/data/domain-read";
import { jsonError, requireRouteClient } from "../../_helpers";

export async function POST(request: Request) {
  const client = await requireRouteClient();
  if ("response" in client) {
    return client.response;
  }

  const { ids } = (await request.json()) as { ids?: string[] };
  const personIds = Array.isArray(ids) ? ids.filter(Boolean) : [];

  if (personIds.length === 0) {
    return NextResponse.json({});
  }

  try {
    const counts = await countConsultationsByPersonIds(personIds, client.userId);
    return NextResponse.json(counts);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to load consultation counts"
    );
  }
}
