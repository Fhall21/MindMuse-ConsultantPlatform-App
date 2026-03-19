import { NextResponse } from "next/server";
import type { AuditLogEntry } from "@/types/db";
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
  const [{ data: roundEntityEvents, error: entityError }, { data: roundPayloadEvents, error: payloadError }] =
    await Promise.all([
      supabase
        .from("audit_log")
        .select("*")
        .eq("entity_type", "consultation_round")
        .eq("entity_id", roundId),
      supabase
        .from("audit_log")
        .select("*")
        .filter("payload->>round_id", "eq", roundId),
    ]);

  if (entityError) {
    return jsonError(entityError.message);
  }

  if (payloadError) {
    return jsonError(payloadError.message);
  }

  const seen = new Set<string>();
  const merged: AuditLogEntry[] = [];

  for (const event of [...(roundEntityEvents ?? []), ...(roundPayloadEvents ?? [])]) {
    if (!seen.has(event.id)) {
      seen.add(event.id);
      merged.push(event as AuditLogEntry);
    }
  }

  merged.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return NextResponse.json(merged);
}
