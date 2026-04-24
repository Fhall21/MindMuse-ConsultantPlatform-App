import { NextRequest, NextResponse } from "next/server";
import {
  featureInterestCreateSchema,
  listFeatureInterests,
  recordFeatureInterest,
} from "@/lib/data/feature-interests";
import { jsonError, requireRouteClient } from "../_helpers";

export async function GET(request: NextRequest) {
  const client = await requireRouteClient();
  if ("response" in client) {
    return client.response;
  }

  try {
    const keys = request.nextUrl.searchParams.get("keys")?.split(",") ?? [];
    const summaries = await listFeatureInterests(client.userId, keys);
    return NextResponse.json({ data: summaries });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to load feature interests");
  }
}

export async function POST(request: NextRequest) {
  const client = await requireRouteClient();
  if ("response" in client) {
    return client.response;
  }

  try {
    const body = await request.json();
    const parsed = featureInterestCreateSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid feature interest payload", 422);
    }

    const summary = await recordFeatureInterest(client.userId, parsed.data.featureKey);
    return NextResponse.json({ data: summary }, { status: 201 });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to record feature interest");
  }
}
