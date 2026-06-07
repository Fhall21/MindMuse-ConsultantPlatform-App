import { afterEach, describe, expect, it, vi } from "vitest";
import { acceptInsightsSequentially } from "@/hooks/use-bulk-accept";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("acceptInsightsSequentially", () => {
  it("patches each junction sequentially and reports progress", async () => {
    let activeRequests = 0;
    let maxActiveRequests = 0;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      activeRequests += 1;
      maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
      await Promise.resolve();
      activeRequests -= 1;
      return new Response(null, { status: 200 });
    });
    const progress = vi.fn();

    const result = await acceptInsightsSequentially(
      [
        { id: "insight-1", gridCellId: "cell-1" },
        { id: "insight-2", gridCellId: "cell-2" },
      ],
      progress
    );

    expect(maxActiveRequests).toBe(1);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/client/insights/insight-1/grid-review",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          cellId: "cell-1",
          gridReviewState: "accepted",
        }),
      })
    );
    expect(progress).toHaveBeenNthCalledWith(1, 1);
    expect(progress).toHaveBeenNthCalledWith(2, 2);
    expect(result).toEqual({ accepted: 2, failed: [] });
  });

  it("continues after request failures and returns failed insight ids", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    await expect(
      acceptInsightsSequentially([
        { id: "insight-1", gridCellId: "cell-1" },
        { id: "insight-2", gridCellId: "cell-2" },
        { id: "insight-3", gridCellId: "cell-3" },
      ])
    ).resolves.toEqual({
      accepted: 1,
      failed: ["insight-1", "insight-2"],
    });
  });
});
