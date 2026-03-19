"use server";

import { getAuthSession } from "@/lib/auth";

export async function getCurrentUserId(): Promise<string | null> {
  const session = await getAuthSession();
  return session?.user.id ?? null;
}

export async function requireCurrentUserId(): Promise<string> {
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  return userId;
}
