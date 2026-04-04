import { NextResponse } from "next/server";
import { getDashboardStats } from "@/lib/data/domain-read";
import { jsonError, requireRouteClient } from "../../_helpers";

export async function GET() {
  const client = await requireRouteClient();
  if ("response" in client) {
    return client.response;
  }

  try {
    const stats = await getDashboardStats(client.userId);
    return NextResponse.json({ ...stats, userId: client.userId });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to load dashboard stats");
  }
}
