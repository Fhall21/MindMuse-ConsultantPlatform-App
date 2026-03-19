import { NextResponse } from "next/server";
import { listAuditUserIds } from "@/lib/data/domain-read";
import { jsonError, requireRouteClient } from "../../_helpers";

export async function GET() {
  const client = await requireRouteClient();
  if ("response" in client) {
    return client.response;
  }

  try {
    const visibleUserIds = await listAuditUserIds(client.userId);
    return NextResponse.json(
      visibleUserIds.map((userId) => ({
        id: userId,
        label: userId === client.userId ? "Current user (me)" : userId,
      }))
    );
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to load audit users");
  }
}
