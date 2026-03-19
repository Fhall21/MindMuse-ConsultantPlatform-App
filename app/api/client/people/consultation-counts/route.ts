import { NextResponse } from "next/server";
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

  const { supabase } = client;
  const { data, error } = await supabase
    .from("consultation_people")
    .select("person_id")
    .in("person_id", personIds);

  if (error) {
    return jsonError(error.message);
  }

  const counts = (data ?? []).reduce<Record<string, number>>((acc, row) => {
    acc[row.person_id] = (acc[row.person_id] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json(counts);
}

