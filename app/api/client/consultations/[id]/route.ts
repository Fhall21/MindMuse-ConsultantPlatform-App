import { NextResponse } from "next/server";
import type { Consultation, EvidenceEmail, Theme } from "@/types/db";
import { jsonError, requireRouteClient } from "../../_helpers";

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

  const [
    { data: consultation, error: consultationError },
    { data: themes, error: themesError },
    { data: people, error: peopleError },
    { data: evidenceEmails, error: emailError },
  ] = await Promise.all([
    supabase.from("consultations").select("*").eq("id", id).single(),
    supabase
      .from("themes")
      .select("*")
      .eq("consultation_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("consultation_people")
      .select("person_id")
      .eq("consultation_id", id),
    supabase
      .from("evidence_emails")
      .select("*")
      .eq("consultation_id", id)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  if (consultationError) {
    return jsonError(consultationError.message, consultationError.code === "PGRST116" ? 404 : 500);
  }
  if (themesError) {
    return jsonError(themesError.message);
  }
  if (peopleError) {
    return jsonError(peopleError.message);
  }
  if (emailError) {
    return jsonError(emailError.message);
  }

  return NextResponse.json({
    consultation: consultation as Consultation,
    themes: (themes ?? []) as Theme[],
    people: people ?? [],
    latestEvidenceEmail: ((evidenceEmails ?? [])[0] ?? null) as EvidenceEmail | null,
  });
}

