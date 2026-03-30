import { NextResponse } from "next/server";
import { jsonError, requireRouteClient } from "../_helpers";
import { reportShareSettingsSchema } from "@/lib/validations/report-share";
import {
  getUserReportShareSettings,
  updateUserReportSharePasscode,
} from "@/lib/data/report-shares";

export async function GET() {
  const client = await requireRouteClient();
  if ("response" in client) return client.response;

  try {
    const settings = await getUserReportShareSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error("Failed to load report share settings:", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to load report share settings"
    );
  }
}

export async function PATCH(request: Request) {
  const client = await requireRouteClient();
  if ("response" in client) return client.response;

  try {
    const body = await request.json();
    const parsed = reportShareSettingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { detail: "Validation failed", errors: parsed.error.format() },
        { status: 400 }
      );
    }

    const settings = await updateUserReportSharePasscode(parsed.data.passcode);
    return NextResponse.json(settings);
  } catch (error) {
    console.error("Failed to update report share settings:", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to update report share settings"
    );
  }
}