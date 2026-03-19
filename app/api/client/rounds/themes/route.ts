import { NextResponse } from "next/server";
import type { Theme } from "@/types/db";
import { jsonError, requireRouteClient } from "../../_helpers";

export async function GET(request: Request) {
  const client = await requireRouteClient();
  if ("response" in client) {
    return client.response;
  }

  const { searchParams } = new URL(request.url);
  const consultationIds = searchParams.getAll("consultationId").filter(Boolean);

  if (consultationIds.length === 0) {
    return NextResponse.json([] as Theme[]);
  }

  const { supabase } = client;
  const { data, error } = await supabase
    .from("themes")
    .select("*")
    .in("consultation_id", consultationIds)
    .order("created_at", { ascending: false });

  if (error) {
    return jsonError(error.message);
  }

  return NextResponse.json((data ?? []) as Theme[]);
}

