import { NextResponse } from "next/server";
import type { Meeting, Person } from "@/types/db";
import {
  getPersonForUser,
  listConsultationsForPerson,
} from "@/lib/data/domain-read";
import { jsonError, requireRouteClient } from "../../_helpers";

interface PersonSheetResponse {
  person: Person;
  consultations: Pick<Meeting, "id" | "title" | "status" | "created_at">[];
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

  try {
    const [person, consultations] = await Promise.all([
      getPersonForUser(id, client.userId),
      listConsultationsForPerson(id, client.userId),
    ]);

    if (!person) {
      return jsonError("Person not found", 404);
    }

    return NextResponse.json({
      person,
      consultations: consultations.map((consultation) => ({
        id: consultation.id,
        title: consultation.title,
        status: consultation.status,
        created_at: consultation.created_at,
      })),
    } satisfies PersonSheetResponse);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to load person");
  }
}
