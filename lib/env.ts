const REQUIRED_ENV_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "AI_SERVICE_URL",
] as const;

type RequiredEnvVar = (typeof REQUIRED_ENV_VARS)[number];

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
