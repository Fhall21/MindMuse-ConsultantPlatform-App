import { NextResponse } from "next/server";
import { jsonError, requireRouteClient } from "../../../_helpers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roundId: string }> }
) {
  const { roundId } = await params;
  const client = await requireRouteClient();
  if ("response" in client) {
    return client.response;
  }

  const { supabase } = client;
  const { data, error } = await supabase
    .from("consultations")
    .select("id, title, status")
    .eq("round_id", roundId)
    .order("created_at", { ascending: true });

  if (error) {
    return jsonError(error.message);
  }

  return NextResponse.json(data ?? []);
}

