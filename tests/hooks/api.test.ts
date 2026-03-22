import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchJson, readErrorMessage } from "@/hooks/api";

describe("hooks/api", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the response text when an API error includes a message", async () => {
    const response = new Response("Not authorized", { status: 401 });

    await expect(readErrorMessage(response)).resolves.toBe("Not authorized");
  });

  it("falls back to the status code when an API error body is empty", async () => {
    const response = new Response("", { status: 503 });

    await expect(readErrorMessage(response)).resolves.toBe(
      "Request failed with status 503"
    );
  });

  it("parses JSON on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))
    );

    await expect(fetchJson<{ ok: boolean }>("/api/example")).resolves.toEqual({
      ok: true,
    });
  });

  it("throws the parsed API error on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Request timed out", { status: 504 }))
    );

    await expect(fetchJson("/api/example")).rejects.toThrow("Request timed out");
  });

  it("extracts the detail field from JSON error responses", async () => {
    const response = new Response(JSON.stringify({ detail: "Analytics failed safely" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });

    await expect(readErrorMessage(response)).resolves.toBe("Analytics failed safely");
  });
});
