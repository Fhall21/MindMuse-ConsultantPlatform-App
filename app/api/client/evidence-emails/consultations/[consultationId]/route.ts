import { NextResponse } from "next/server";
import type { EvidenceEmail } from "@/types/db";
import { jsonError, requireRouteClient } from "../../../_helpers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ consultationId: string }> }
) {
  const { consultationId } = await params;
  const client = await requireRouteClient();
  if ("response" in client) {
    return client.response;
  }

  const { supabase } = client;
  const { data, error } = await supabase
    .from("evidence_emails")
    .select("*")
    .eq("consultation_id", consultationId)
    .order("created_at", { ascending: false });

  if (error) {
    return jsonError(error.message);
  }

  return NextResponse.json((data ?? []) as EvidenceEmail[]);
}
