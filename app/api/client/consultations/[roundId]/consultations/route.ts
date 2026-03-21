import { NextResponse } from "next/server";
import { listConsultationsForRound } from "@/lib/data/domain-read";
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

  try {
    const consultations = await listConsultationsForRound(roundId, client.userId);
    return NextResponse.json(
      consultations.map((consultation) => ({
        id: consultation.id,
        title: consultation.title,
        status: consultation.status,
      }))
    );
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to load consultation meetings"
    );
  }
}
