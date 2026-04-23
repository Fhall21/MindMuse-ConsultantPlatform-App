// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchJsonMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/api", () => ({
  fetchJson: fetchJsonMock,
}));

import { useInterviewSession } from "@/hooks/use-interview-session";

const flow = {
  id: "flow-1",
  title: "Digital interview",
  framework: "appreciative_inquiry",
  custom_framework_prompt: null,
  topics: ["Workload"],
  depth_level: "moderate",
  status: "active",
} as const;

const newSession = {
  id: "response-1",
  flow_id: "flow-1",
  session_token: "session-1",
  interviewee_name: null,
  interviewee_email: null,
  interviewee_role: null,
  interviewee_work_group: null,
  interviewee_organisation: null,
  person_id: null,
  person_match_confidence: null,
  conversation_history: [],
  status: "in_progress",
  completed_at: null,
  created_at: "2026-04-23T10:00:00.000Z",
  updated_at: "2026-04-23T10:00:00.000Z",
} as const;

const resumedSession = {
  ...newSession,
  interviewee_name: "Alex",
  interviewee_role: "Manager",
  interviewee_work_group: "Operations",
  interviewee_organisation: "Example Org",
  conversation_history: [{ role: "assistant", content: "Welcome", timestamp: "2026-04-23T10:00:00.000Z" }],
} as const;

const updatedSession = {
  ...resumedSession,
  conversation_history: resumedSession.conversation_history,
} as const;

function mockFetchSessionFlow(nextSession: typeof newSession | typeof resumedSession) {
  fetchJsonMock.mockImplementation(async (url: string, options?: RequestInit) => {
    if (url === "/api/public/digital-interviews/share-1") {
      return flow;
    }

    if (url === "/api/public/digital-interviews/share-1/session" && options?.method === "POST") {
      return nextSession;
    }

    if (
      url === "/api/public/digital-interviews/share-1/session/session-1/details" &&
      options?.method === "PATCH"
    ) {
      return updatedSession;
    }

    throw new Error(`Unexpected request: ${url}`);
  });
}

describe("useInterviewSession", () => {
  beforeEach(() => {
    fetchJsonMock.mockReset();

    const storage = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
        clear: () => {
          storage.clear();
        },
      },
    });
  });

  it("creates a new session, stores the token, and advances to chat after onboarding", async () => {
    mockFetchSessionFlow(newSession);

    const { result } = renderHook(() => useInterviewSession("share-1"));

    await waitFor(() => expect(result.current.phase).toBe("onboarding"));
    expect(window.localStorage.getItem("di_session_share-1")).toBe("session-1");

    await act(async () => {
      await result.current.submitDetails({
        name: "Alex",
        role: "Manager",
        work_group: "Operations",
        organisation: "Example Org",
        email: "alex@example.com",
      });
    });

    await waitFor(() => expect(result.current.phase).toBe("chat"));
    expect(result.current.contextValue).toMatchObject({
      flowId: "flow-1",
      flowTitle: "Digital interview",
      sessionToken: "session-1",
      intervieweeName: "Alex",
    });
    expect(window.localStorage.getItem("di_session_share-1")).toBe("session-1");
    expect(fetchJsonMock).toHaveBeenNthCalledWith(
      3,
      "/api/public/digital-interviews/share-1/session/session-1/details",
      expect.objectContaining({ method: "PATCH" })
    );
  });

  it("resumes chat when a stored token is still valid", async () => {
    window.localStorage.setItem("di_session_share-1", "session-1");
    mockFetchSessionFlow(resumedSession);

    const { result } = renderHook(() => useInterviewSession("share-1"));

    await waitFor(() => expect(result.current.phase).toBe("chat"));
    expect(result.current.contextValue).toMatchObject({
      intervieweeName: "Alex",
      sessionToken: "session-1",
    });
    expect(fetchJsonMock).toHaveBeenNthCalledWith(
      2,
      "/api/public/digital-interviews/share-1/session",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ sessionToken: "session-1" }),
      })
    );
  });
});
