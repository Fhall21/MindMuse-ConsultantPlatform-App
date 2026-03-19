import { NextResponse } from "next/server";
import type { ConsultationRound } from "@/types/db";
import { jsonError, requireRouteClient } from "../_helpers";

export async function GET() {
  const client = await requireRouteClient();
  if ("response" in client) {
    return client.response;
  }

  const { supabase } = client;
  const { data, error } = await supabase
    .from("consultation_rounds")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return jsonError(error.message);
  }

  return NextResponse.json((data ?? []) as ConsultationRound[]);
}

