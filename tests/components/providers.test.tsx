// @vitest-environment jsdom

import { useQueryClient } from "@tanstack/react-query";
import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Providers } from "@/components/providers";

const sessionState = vi.hoisted(() => ({
  current: { user: { id: "user-a" } } as { user: { id: string } } | null,
  isPending: false,
}));

vi.mock("@/lib/auth/client", () => ({
  authClient: {
    useSession: () => ({
      data: sessionState.current,
      isPending: sessionState.isPending,
      error: null,
      refetch: vi.fn(),
    }),
  },
}));

vi.mock("@/components/settings/accessibility-preferences", () => ({
  AccessibilityPreferencesSync: () => null,
}));

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/components/ui/sonner", () => ({
  Toaster: () => null,
}));

let observedQueryClient: ReturnType<typeof useQueryClient> | null = null;

function QueryClientProbe() {
  observedQueryClient = useQueryClient();
  return null;
}

describe("Providers", () => {
  beforeEach(() => {
    sessionState.current = { user: { id: "user-a" } };
    sessionState.isPending = false;
    observedQueryClient = null;
  });

  it("clears cached queries when the authenticated user changes", async () => {
    const { rerender } = render(
      <Providers>
        <QueryClientProbe />
      </Providers>
    );

    expect(observedQueryClient).not.toBeNull();

    act(() => {
      observedQueryClient?.setQueryData(["meetings", "active"], [{ id: "meeting-a" }]);
    });

    expect(observedQueryClient?.getQueryData(["meetings", "active"])).toEqual([
      { id: "meeting-a" },
    ]);

    sessionState.current = { user: { id: "user-b" } };

    rerender(
      <Providers>
        <QueryClientProbe />
      </Providers>
    );

    await waitFor(() => {
      expect(observedQueryClient?.getQueryData(["meetings", "active"])).toBeUndefined();
    });
  });
});