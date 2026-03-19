import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { accounts, profiles, sessions, users, verifications } from "@/db/schema";
import { getAppSiteUrl, getBetterAuthSecret, getTrustedOrigins } from "@/lib/env";

export const auth = betterAuth({
  appName: "ConsultantPlatform",
  baseURL: getAppSiteUrl(),
  basePath: "/api/auth",
  secret: getBetterAuthSecret(),
  trustedOrigins: getTrustedOrigins(),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  user: {
    changeEmail: {
      enabled: true,
      updateEmailWithoutVerification: true,
    },
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
    database: {
      generateId: "uuid",
    },
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      users,
      sessions,
      accounts,
      verifications,
    },
    usePlural: true,
  }),
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await db.insert(profiles).values({ userId: user.id }).onConflictDoNothing();
        },
      },
    },
  },
  plugins: [nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session & {
  profile: {
    displayName: string | null;
    fullName: string | null;
  } | null;
};

async function getProfile(userId: string) {
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

export async function getAuthSession(): Promise<AuthSession | null> {
  const requestHeaders = new Headers(await headers());
  const session = await auth.api.getSession({
    headers: requestHeaders,
  });

  if (!session) {
    return null;
  }

  const profile = await getProfile(session.user.id);

  return {
    ...session,
    profile,
  };
}

export async function requireAuthSession(): Promise<AuthSession> {
  const session = await getAuthSession();

  if (!session) {
    throw new Error("Not authenticated");
  }

  return session;
}

export function getSessionDisplayName(session: Pick<AuthSession, "profile" | "user">): string {
  return (
    session.profile?.displayName ??
    session.profile?.fullName ??
    session.user.name ??
    session.user.email
  );
}
