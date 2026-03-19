const REQUIRED_ENV_VARS = [
  "APP_SITE_URL",
  "BETTER_AUTH_SECRET",
  "AI_SERVICE_URL",
] as const;

type DatabaseEnvVar =
  | "DATABASE_URL"
  | "DATABASE_HOST"
  | "DATABASE_PORT"
  | "DATABASE_NAME"
  | "DATABASE_USER"
  | "DATABASE_PASSWORD";

type RequiredEnvVar =
  | (typeof REQUIRED_ENV_VARS)[number]
  | DatabaseEnvVar;

export function requireEnv(name: RequiredEnvVar): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function validateRequiredEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
}

const PRODUCTION_BLOCKED_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);
const LOCAL_DEV_HOST_ALIASES = new Map<string, string[]>([
  ["localhost", ["127.0.0.1", "[::1]"]],
  ["127.0.0.1", ["localhost", "[::1]"]],
  ["[::1]", ["localhost", "127.0.0.1"]],
  ["0.0.0.0", ["localhost", "127.0.0.1", "[::1]"]],
]);

function parseHttpUrl(rawUrl: string, envName: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`${envName} must be a valid URL`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${envName} must use http or https`);
  }

  if (
    process.env.NODE_ENV === "production" &&
    PRODUCTION_BLOCKED_HOSTNAMES.has(parsed.hostname)
  ) {
    throw new Error(`${envName} cannot point to localhost in production`);
  }

  return parsed;
}

export function getAiServiceUrl(): string {
  const rawUrl = requireEnv("AI_SERVICE_URL");
  const parsed = parseHttpUrl(rawUrl, "AI_SERVICE_URL");
  return parsed.toString().replace(/\/$/, "");
}

export function getAppSiteUrl(): string {
  const parsed = parseHttpUrl(requireEnv("APP_SITE_URL"), "APP_SITE_URL");
  return parsed.toString().replace(/\/$/, "");
}

export function getBetterAuthSecret(): string {
  return requireEnv("BETTER_AUTH_SECRET");
}

export function getTrustedOrigins(): string[] {
  const origins = new Set<string>();
  addTrustedOrigin(origins, getAppSiteUrl());
  const rawAllowedOrigins = process.env.ALLOWED_ORIGINS;

  if (!rawAllowedOrigins) {
    return [...origins];
  }

  for (const origin of rawAllowedOrigins.split(",")) {
    const trimmed = origin.trim();
    if (!trimmed) {
      continue;
    }

    addTrustedOrigin(
      origins,
      parseHttpUrl(trimmed, "ALLOWED_ORIGINS").toString().replace(/\/$/, "")
    );
  }

  return [...origins];
}

function addTrustedOrigin(origins: Set<string>, origin: string) {
  origins.add(origin);

  const parsed = new URL(origin);
  const aliases = LOCAL_DEV_HOST_ALIASES.get(parsed.hostname);
  if (!aliases) {
    return;
  }

  for (const alias of aliases) {
    const aliasUrl = new URL(origin);
    aliasUrl.hostname = alias;
    origins.add(aliasUrl.toString().replace(/\/$/, ""));
  }
}

export function getDatabaseUrl(): string {
  const directUrl = process.env.DATABASE_URL;

  if (directUrl) {
    return validateDatabaseUrl(directUrl);
  }

  const host = requireEnv("DATABASE_HOST");
  const port = process.env.DATABASE_PORT || "5432";
  const name = requireEnv("DATABASE_NAME");
  const user = requireEnv("DATABASE_USER");
  const password = requireEnv("DATABASE_PASSWORD");

  const constructedUrl = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${name}`;
  return validateDatabaseUrl(constructedUrl);
}

function validateDatabaseUrl(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection string");
  }

  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL must use postgres or postgresql");
  }

  return parsed.toString();
}
