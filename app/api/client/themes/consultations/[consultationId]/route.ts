import { NextResponse } from "next/server";
import type { Theme } from "@/types/db";
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
    .from("themes")
    .select("*")
    .eq("consultation_id", consultationId)
    .order("created_at", { ascending: false });

  if (error) {
    return jsonError(error.message);
  }

  return NextResponse.json((data ?? []) as Theme[]);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ consultationId: string }> }
) {
  const { consultationId } = await params;
  const client = await requireRouteClient();
  if ("response" in client) {
    return client.response;
  }

  const { supabase } = client;
  const { error } = await supabase
    .from("themes")
    .delete()
    .eq("consultation_id", consultationId);

  if (error) {
    return jsonError(error.message);
  }

  return NextResponse.json({ ok: true });
}
