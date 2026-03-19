import { NextResponse } from "next/server";
import type { Person } from "@/types/db";
import { jsonError, requireRouteClient } from "../../../_helpers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const client = await requireRouteClient();
  if ("response" in client) {
    return client.response;
  }

  const { supabase } = client;
  const { data: links, error: linksError } = await supabase
    .from("consultation_people")
    .select("person_id")
    .eq("consultation_id", id);

  if (linksError) {
    return jsonError(linksError.message);
  }

  const personIds = (links ?? []).map((link) => link.person_id);
  if (personIds.length === 0) {
    return NextResponse.json([] as Person[]);
  }

  const { data: people, error: peopleError } = await supabase
    .from("people")
    .select("*")
    .in("id", personIds);

  if (peopleError) {
    return jsonError(peopleError.message);
  }

  return NextResponse.json((people ?? []) as Person[]);
}

