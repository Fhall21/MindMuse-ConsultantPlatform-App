import { NextResponse } from "next/server";
import { requireRouteClient } from "../_helpers";
import { getClientFeatureFlagsForUser } from "@/lib/feature-flags";

export async function GET() {
  const auth = await requireRouteClient();
  if ("response" in auth) return auth.response;
  return NextResponse.json(getClientFeatureFlagsForUser(auth.userId));
}
