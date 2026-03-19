"use server";

import { createClient } from "@/lib/supabase/server";

// Temporary bridge: Stage 5 moves data access off Supabase first, while the
// auth/session worker replaces Supabase auth with Better Auth in parallel.
export async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.id ?? null;
}

export async function requireCurrentUserId(): Promise<string> {
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  return userId;
}
