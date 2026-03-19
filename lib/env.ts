const REQUIRED_ENV_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "AI_SERVICE_URL",
] as const;

const DATABASE_ENV_VARS = [
  "DATABASE_URL",
  "DATABASE_HOST",
  "DATABASE_PORT",
  "DATABASE_NAME",
  "DATABASE_USER",
  "DATABASE_PASSWORD",
] as const;

type RequiredEnvVar =
  | (typeof REQUIRED_ENV_VARS)[number]
  | (typeof DATABASE_ENV_VARS)[number];

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

export function getAiServiceUrl(): string {
  const rawUrl = requireEnv("AI_SERVICE_URL");

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("AI_SERVICE_URL must be a valid URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("AI_SERVICE_URL must use http or https");
  }

  if (
    process.env.NODE_ENV === "production" &&
    PRODUCTION_BLOCKED_HOSTNAMES.has(parsed.hostname)
  ) {
    throw new Error("AI_SERVICE_URL cannot point to localhost in production");
  }

  return parsed.toString().replace(/\/$/, "");
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
