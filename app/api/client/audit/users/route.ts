import { NextResponse } from "next/server";
import { jsonError, requireRouteClient } from "../../_helpers";

export async function GET() {
  const client = await requireRouteClient();
  if ("response" in client) {
    return client.response;
  }

  const { supabase, user } = client;
  const { data: auditRows, error } = await supabase
    .from("audit_log")
    .select("user_id")
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) {
    return jsonError(error.message);
  }

  const visibleUserIds = Array.from(
    new Set(
      (auditRows ?? [])
        .map((row: { user_id: string | null }) => row.user_id)
        .filter((value): value is string => Boolean(value))
    )
  );

  return NextResponse.json(
    visibleUserIds.map((userId) => ({
      id: userId,
      label: userId === user.id ? `${user.email ?? "Current user"} (me)` : userId,
    }))
  );
}
