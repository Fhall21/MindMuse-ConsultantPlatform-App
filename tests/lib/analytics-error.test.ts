import { describe, expect, it } from "vitest";
import {
  DEFAULT_ANALYTICS_ERROR_MESSAGE,
  sanitizeAnalyticsErrorMessage,
} from "@/lib/analytics-error";

describe("lib/analytics-error", () => {
  it("passes through short user-safe analytics messages", () => {
    expect(sanitizeAnalyticsErrorMessage("Meeting not found")).toBe("Meeting not found");
  });

  it("replaces technical SQL failures with a safe fallback", () => {
    expect(
      sanitizeAnalyticsErrorMessage(
        "(psycopg2.errors.InvalidColumnReference) there is no unique or exclusion constraint matching the ON CONFLICT specification [SQL: INSERT INTO term_embeddings ...]"
      )
    ).toBe(DEFAULT_ANALYTICS_ERROR_MESSAGE);
  });

  it("replaces oversized backend failures with a safe fallback", () => {
    expect(sanitizeAnalyticsErrorMessage("x".repeat(400))).toBe(
      DEFAULT_ANALYTICS_ERROR_MESSAGE
    );
  });
});