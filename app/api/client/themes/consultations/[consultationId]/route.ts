import { NextResponse } from "next/server";
import {
  getConsultationForUser,
  deleteThemesForConsultation,
  listThemesForConsultation,
} from "@/lib/data/domain-read";
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

  try {
    const consultation = await getConsultationForUser(consultationId, client.userId);

    if (!consultation) {
      return jsonError("Consultation not found", 404);
    }

    const themes = await listThemesForConsultation(
      consultationId,
      client.userId
    );
    return NextResponse.json(themes);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(
      `[consultation-themes] failed to load themes for ${consultationId}: ${detail}`
    );
    return NextResponse.json([]);
  }
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

  try {
    await deleteThemesForConsultation(consultationId, client.userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to delete themes");
  }
}
