import { NextResponse } from "next/server";
import type { Consultation, Person } from "@/types/db";
import { jsonError, requireRouteClient } from "../../_helpers";

interface PersonSheetResponse {
  person: Person;
  consultations: Pick<Consultation, "id" | "title" | "status" | "created_at">[];
}

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
  const { data: person, error: personError } = await supabase
    .from("people")
    .select("*")
    .eq("id", id)
    .single();

  if (personError) {
    return jsonError(personError.message, personError.code === "PGRST116" ? 404 : 500);
  }

  const { data: links, error: linksError } = await supabase
    .from("consultation_people")
    .select("consultation_id")
    .eq("person_id", id);

  if (linksError) {
    return jsonError(linksError.message);
  }

  const consultationIds = (links ?? []).map((link) => link.consultation_id);

  if (consultationIds.length === 0) {
    return NextResponse.json({
      person,
      consultations: [],
    } satisfies PersonSheetResponse);
  }

  const { data: consultations, error: consultationsError } = await supabase
    .from("consultations")
    .select("id,title,status,created_at")
    .in("id", consultationIds)
    .order("created_at", { ascending: false });

  if (consultationsError) {
    return jsonError(consultationsError.message);
  }

  return NextResponse.json({
    person,
    consultations: consultations ?? [],
  } satisfies PersonSheetResponse);
}

