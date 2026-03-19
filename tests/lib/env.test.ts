import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getAiServiceUrl,
  getAppSiteUrl,
  getDatabaseUrl,
  getTrustedOrigins,
} from "@/lib/env";

const ORIGINAL_ENV = { ...process.env };

describe("lib/env", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllEnvs();
  });

  it("builds a database URL from discrete Postgres environment variables", () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("DATABASE_HOST", "db");
    vi.stubEnv("DATABASE_PORT", "5432");
    vi.stubEnv("DATABASE_NAME", "consultant_platform");
    vi.stubEnv("DATABASE_USER", "postgres");
    vi.stubEnv("DATABASE_PASSWORD", "secret");

    expect(getDatabaseUrl()).toBe(
      "postgresql://postgres:secret@db:5432/consultant_platform"
    );
  });

  it("normalizes app and AI URLs without trailing slashes", () => {
    vi.stubEnv("APP_SITE_URL", "https://app.example.com/");
    vi.stubEnv("AI_SERVICE_URL", "http://ai.internal:8000/");

    expect(getAppSiteUrl()).toBe("https://app.example.com");
    expect(getAiServiceUrl()).toBe("http://ai.internal:8000");
  });

  it("includes ALLOWED_ORIGINS alongside APP_SITE_URL for trusted origins", () => {
    vi.stubEnv("APP_SITE_URL", "https://app.example.com");
    vi.stubEnv(
      "ALLOWED_ORIGINS",
      "https://app.example.com, https://admin.example.com"
    );

    expect(getTrustedOrigins()).toEqual([
      "https://app.example.com",
      "https://admin.example.com",
    ]);
  });

  it("treats localhost and loopback aliases as trusted in local development", () => {
    vi.stubEnv("APP_SITE_URL", "http://localhost:3000");
    vi.stubEnv("ALLOWED_ORIGINS", "http://localhost:3000");

    expect(getTrustedOrigins()).toEqual([
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://[::1]:3000",
    ]);
  });
});
