import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { auth, type AuthSession } from "@/lib/auth";
import { db } from "@/db/client";
import { profiles } from "@/db/schema";

export type SessionProfile = {
  displayName: string | null;
  fullName: string | null;
};

export async function getServerSession(): Promise<AuthSession | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return null;
  }

  const [profile] = await db
    .select({
      displayName: profiles.displayName,
      fullName: profiles.fullName,
    })
    .from(profiles)
    .where(eq(profiles.userId, session.user.id))
    .limit(1);

  return {
    ...session,
    profile: profile ?? null,
  };
}

export async function getSessionProfile(userId: string): Promise<SessionProfile | null> {
  const [profile] = await db
    .select({
      displayName: profiles.displayName,
      fullName: profiles.fullName,
    })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  return profile ?? null;
}

export async function getCurrentUserContext() {
  const session = await getServerSession();

  if (!session) {
    return null;
  }

  return {
    session,
    profile: session.profile,
  };
}

export function getDisplayName(
  session: AuthSession | null,
  profile: SessionProfile | null
): string | undefined {
  if (profile?.displayName) {
    return profile.displayName;
  }

  if (profile?.fullName) {
    return profile.fullName;
  }

  return session?.user.name ?? undefined;
}
