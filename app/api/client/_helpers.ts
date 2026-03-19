import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/data/auth-context";

export async function requireRouteClient() {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return {
        response: NextResponse.json({ detail: "Unauthorized" }, { status: 401 }),
      };
    }

    return {
      userId,
    };
  } catch (error) {
    console.error("Failed to resolve route auth context", error);
    return {
      response: NextResponse.json(
        { detail: "Failed to validate session" },
        { status: 503 }
      ),
    };
  }
}

export function jsonError(detail: string, status = 500) {
  return NextResponse.json({ detail }, { status });
}
