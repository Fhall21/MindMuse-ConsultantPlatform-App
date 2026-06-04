import { describe, expect, it } from "vitest";
import { isChatProtectedFastApiPath } from "@/lib/chat/protected-paths";

describe("isChatProtectedFastApiPath", () => {
  it("treats /themes/extract as protected", () => {
    expect(isChatProtectedFastApiPath("/themes/extract")).toBe(true);
  });

  it("normalizes paths without a leading slash", () => {
    expect(isChatProtectedFastApiPath("themes/extract")).toBe(true);
  });

  it("leaves meeting metadata inference open to legacy proxies", () => {
    expect(isChatProtectedFastApiPath("/infer/meeting-metadata")).toBe(false);
  });
});
