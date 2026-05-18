import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getClientFeatureFlagsForUser,
  isResearchExtractionEnabledForUser,
} from "@/lib/feature-flags";

const ENV_KEY = "RESEARCH_EXTRACTION_ENABLED";
const original = process.env[ENV_KEY];

afterEach(() => {
  if (original === undefined) {
    delete process.env[ENV_KEY];
  } else {
    process.env[ENV_KEY] = original;
  }
});

beforeEach(() => {
  delete process.env[ENV_KEY];
});

describe("isResearchExtractionEnabledForUser", () => {
  it("returns false when env is unset", () => {
    expect(isResearchExtractionEnabledForUser("u-1")).toBe(false);
  });

  it("returns true for any user when env is '*'", () => {
    process.env[ENV_KEY] = "*";
    expect(isResearchExtractionEnabledForUser("u-1")).toBe(true);
    expect(isResearchExtractionEnabledForUser("u-2")).toBe(true);
  });

  it("returns true for any user when env is 'true'", () => {
    process.env[ENV_KEY] = "true";
    expect(isResearchExtractionEnabledForUser("u-1")).toBe(true);
  });

  it("matches a comma-separated allowlist", () => {
    process.env[ENV_KEY] = "u-1, u-3 , u-7";
    expect(isResearchExtractionEnabledForUser("u-1")).toBe(true);
    expect(isResearchExtractionEnabledForUser("u-7")).toBe(true);
    expect(isResearchExtractionEnabledForUser("u-9")).toBe(false);
  });

  it("returns false for empty list", () => {
    process.env[ENV_KEY] = "";
    expect(isResearchExtractionEnabledForUser("u-1")).toBe(false);
  });
});

describe("getClientFeatureFlagsForUser", () => {
  it("exposes the resolved flag set", () => {
    process.env[ENV_KEY] = "u-1";
    const flags = getClientFeatureFlagsForUser("u-1");
    expect(flags.researchExtractionEnabled).toBe(true);
  });

  it("defaults to false when user not in allowlist", () => {
    process.env[ENV_KEY] = "u-7";
    expect(getClientFeatureFlagsForUser("u-1").researchExtractionEnabled).toBe(false);
  });
});
