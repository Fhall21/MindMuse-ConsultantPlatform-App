import { NextResponse } from "next/server";
import { countPeopleByConsultationIds } from "@/lib/data/domain-read";
import { uuidArraySchema } from "@/lib/validations/consultation";
import { jsonError, requireRouteClient } from "../../_helpers";

export async function POST(request: Request) {
  const client = await requireRouteClient();
  if ("response" in client) {
    return client.response;
  }

  const body = (await request.json()) as { ids?: unknown };
  const parsed = uuidArraySchema(100).safeParse(body.ids ?? []);
  if (!parsed.success) {
    return jsonError("Invalid consultation IDs", 400);
  }
  const consultationIds = parsed.data;

  if (consultationIds.length === 0) {
    return NextResponse.json({});
  }

  try {
    const counts = await countPeopleByConsultationIds(
      consultationIds,
      client.userId
    );
    return NextResponse.json(counts);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to load consultation people counts"
    );
  }
}
