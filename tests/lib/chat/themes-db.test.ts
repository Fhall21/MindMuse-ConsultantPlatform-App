import { beforeEach, describe, expect, it, vi } from "vitest";

const ownershipMock = vi.hoisted(() => ({
  requireOwnedMeeting: vi.fn(),
  requireOwnedTheme: vi.fn(),
}));

const dispatchMock = vi.hoisted(() => ({
  dispatchToolToFastApi: vi.fn(),
}));

const persistMock = vi.hoisted(() => ({
  dismissPriorPendingToolResults: vi.fn(),
}));

const auditMock = vi.hoisted(() => ({
  emitAuditEvent: vi.fn(),
}));

const dbState = vi.hoisted(() => ({
  insertReturning: [{ id: "insight-1", label: "Theme A", description: "Desc" }],
}));

const fakeDb = vi.hoisted(() => ({
  insert: vi.fn(() => ({
    values: () => ({
      returning: async () => dbState.insertReturning,
    }),
  })),
}));

vi.mock("@/db/client", () => ({ db: fakeDb }));
vi.mock("@/lib/data/ownership", () => ownershipMock);
vi.mock("@/lib/chat/tool-dispatch", () => dispatchMock);
vi.mock("@/lib/chat/persist", () => persistMock);
vi.mock("@/lib/actions/audit", () => auditMock);
vi.mock("@/lib/chat/theme-personalization", () => ({
  loadThemePersonalizationContext: vi.fn(async () => ({
    learning_signals: [],
    ai_learnings: [],
    user_preferences: null,
  })),
}));

import { extractAndPersistThemes, loadMeetingTranscript } from "@/lib/chat/themes-db";

describe("lib/chat/themes-db", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ownershipMock.requireOwnedMeeting.mockResolvedValue({
      id: "meeting-1",
      consultationId: "consult-1",
      transcriptRaw: "Full transcript text",
      notes: null,
      status: "draft",
    });
    dispatchMock.dispatchToolToFastApi.mockResolvedValue({
      ok: true,
      data: {
        themes: [
          {
            label: "Theme A",
            description: "Desc",
            confidence: 0.8,
          },
        ],
      },
    });
  });

  it("loads transcript from owned meeting", async () => {
    const result = await loadMeetingTranscript("user-1", "meeting-1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.transcript).toBe("Full transcript text");
    }
  });

  it("extracts themes, dismisses prior pending rows, and persists insights", async () => {
    const result = await extractAndPersistThemes({
      userId: "user-1",
      sessionId: "session-1",
      meetingId: "meeting-1",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.themes).toHaveLength(1);
      expect(result.output.themes[0]?.id).toBe("insight-1");
      expect(result.output.themes[0]?.source_quotes).toEqual([]);
    }

    expect(persistMock.dismissPriorPendingToolResults).toHaveBeenCalledWith(
      "session-1",
      "extract_themes"
    );
    expect(dispatchMock.dispatchToolToFastApi).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: "/themes/extract",
        body: expect.objectContaining({ transcript: "Full transcript text" }),
      })
    );
    expect(auditMock.emitAuditEvent).toHaveBeenCalled();
  });
});
