import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession,
    },
  },
}));

describe("proxy", () => {
  beforeEach(() => {
    getSession.mockReset();
  });

  it("allows public auth pages through without loading a session", async () => {
    const { proxy } = await import("@/proxy");
    const request = new NextRequest("https://app.example.com/login");

    const response = await proxy(request);

    expect(getSession).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("redirects unauthenticated app requests to /login", async () => {
    getSession.mockResolvedValue(null);

    const { proxy } = await import("@/proxy");
    const request = new NextRequest("https://app.example.com/dashboard");

    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://app.example.com/login");
  });

  it("allows authenticated app requests through", async () => {
    getSession.mockResolvedValue({
      user: { id: "user-1" },
    });

    const { proxy } = await import("@/proxy");
    const request = new NextRequest("https://app.example.com/dashboard");

    const response = await proxy(request);

    expect(response.status).toBe(200);
  });
});
