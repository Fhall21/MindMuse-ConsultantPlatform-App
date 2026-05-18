import { NextResponse } from "next/server";
import { jsonError, requireRouteClient } from "../../../_helpers";
import { listResearchInsightLibrary } from "@/lib/data/research-insights";

export async function GET(request: Request) {
  const auth = await requireRouteClient();
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const limitParam = searchParams.get("limit");
  const limit = Math.min(
    100,
    Math.max(1, limitParam ? Number.parseInt(limitParam, 10) || 50 : 50)
  );

  try {
    const items = await listResearchInsightLibrary(auth.userId, q, limit);
    return NextResponse.json({ items });
  } catch (error) {
    console.error("research-insight library list failed", error);
    return jsonError("Could not load research insight library", 500);
  }
}
