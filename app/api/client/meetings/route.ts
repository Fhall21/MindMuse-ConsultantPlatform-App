import { NextResponse } from "next/server";
import { listConsultationsForUser } from "@/lib/data/domain-read";
import { jsonError, requireRouteClient } from "../_helpers";

export async function GET() {
  const client = await requireRouteClient();
  if ("response" in client) {
    return client.response;
  }

  try {
    const meetings = await listConsultationsForUser(client.userId);
    return NextResponse.json(meetings);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to load meetings");
  }
}
