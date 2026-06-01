import { beforeEach, describe, expect, it, vi } from "vitest";

const ownershipMock = vi.hoisted(() => ({
  requireOwnedConsultation: vi.fn(),
  requireOwnedMeeting: vi.fn(),
}));

const auditMock = vi.hoisted(() => ({
  emitAuditEvent: vi.fn(),
}));

const dbState = vi.hoisted(() => ({
  insertValues: null as Record<string, unknown> | null,
  insertReturning: [{ id: "meeting-1", title: "Test", meetingDate: new Date("2026-05-01T12:00:00.000Z"), consultationId: "project-1" }],
}));

const fakeDb = vi.hoisted(() => ({
  insert: vi.fn(() => ({
    values: (values: Record<string, unknown>) => {
      dbState.insertValues = values;
      return {
        returning: async () => dbState.insertReturning,
      };
    },
  })),
  select: vi.fn(() => ({
    from: () => ({
      where: () => ({
        limit: async () => [],
      }),
    }),
  })),
}));

vi.mock("@/db/client", () => ({ db: fakeDb }));
vi.mock("@/lib/data/ownership", () => ownershipMock);
vi.mock("@/lib/actions/audit", () => auditMock);

import { confirmMeetingFromDraft } from "@/lib/chat/intake-db";

describe("lib/chat/intake-db confirmMeetingFromDraft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbState.insertValues = null;
    ownershipMock.requireOwnedConsultation.mockResolvedValue(undefined);
  });

  it("writes a draft meeting for the owned project", async () => {
    const record = await confirmMeetingFromDraft({
      userId: "user-1",
      projectId: "project-1",
      meetingDraft: {
        title: "Weekly sync",
        date: "2026-05-01T12:00:00.000Z",
        participants: ["Alex"],
        notes_preview: "Notes",
        source_text: "Full transcript",
        intake_kind: "transcript",
      },
    });

    expect(record.id).toBe("meeting-1");
    expect(record.projectId).toBe("project-1");
    expect(dbState.insertValues).toMatchObject({
      title: "Weekly sync",
      consultationId: "project-1",
      transcriptRaw: "Full transcript",
    });
    expect(auditMock.emitAuditEvent).toHaveBeenCalled();
  });
});
