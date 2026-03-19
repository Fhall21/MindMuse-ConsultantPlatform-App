import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function requireRouteClient() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    return {
      response: NextResponse.json(
        { detail: "Failed to validate session" },
        { status: 503 }
      ),
    };
  }

  if (!user) {
    return {
      response: NextResponse.json({ detail: "Unauthorized" }, { status: 401 }),
    };
  }

  return { supabase, user };
}

export function jsonError(detail: string, status = 500) {
  return NextResponse.json({ detail }, { status });
}

