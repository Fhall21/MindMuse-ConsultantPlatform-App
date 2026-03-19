import { NextResponse } from "next/server";
import { jsonError, requireRouteClient } from "../../_helpers";

export async function POST(request: Request) {
  const client = await requireRouteClient();
  if ("response" in client) {
    return client.response;
  }

  const { ids } = (await request.json()) as { ids?: string[] };
  const roundIds = Array.isArray(ids) ? ids.filter(Boolean) : [];

  if (roundIds.length === 0) {
    return NextResponse.json({});
  }

  const { supabase } = client;
  const { data, error } = await supabase
    .from("consultations")
    .select("round_id")
    .in("round_id", roundIds);

  if (error) {
    return jsonError(error.message);
  }

  const counts = (data ?? []).reduce<Record<string, number>>((acc, row) => {
    if (!row.round_id) {
      return acc;
    }

    acc[row.round_id] = (acc[row.round_id] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json(counts);
}

