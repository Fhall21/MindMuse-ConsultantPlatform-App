import { beforeEach, describe, expect, it, vi } from "vitest";

const authContextMock = vi.hoisted(() => ({
  requireCurrentUserId: vi.fn(),
}));

const auditLogMock = vi.hoisted(() => ({
  emitAuditEvent: vi.fn(),
}));

const testState = vi.hoisted(() => ({
  selectResult: [] as unknown[],
  lastUpdateValues: null as Record<string, unknown> | null,
}));

function makeSelectBuilder(result: unknown[]) {
  const builder: Record<string, unknown> = {
    from: () => builder,
    where: () => builder,
    limit: () => builder,
    then: (resolve: (value: unknown[]) => void, reject: (reason?: unknown) => void) =>
      Promise.resolve(result).then(resolve, reject),
  };

  return builder;
}

const fakeDb = vi.hoisted(() => ({
  select: vi.fn(() => makeSelectBuilder(testState.selectResult)),
  update: vi.fn(() => ({
    set: (values: Record<string, unknown>) => ({
      where: async () => {
        testState.lastUpdateValues = values;
        return undefined;
      },
    }),
  })),
}));

vi.mock("@/db/client", () => ({
  db: fakeDb,
}));
vi.mock("@/lib/data/auth-context", () => authContextMock);
vi.mock("@/lib/data/audit-log", () => auditLogMock);

import { updateNotes } from "@/lib/actions/consultations";

describe("lib/actions/consultations updateNotes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authContextMock.requireCurrentUserId.mockResolvedValue("user-1");
    testState.selectResult = [];
    testState.lastUpdateValues = null;
  });

  it("saves meeting notes and emits an audit event", async () => {
    testState.selectResult = [
      {
        id: "meeting-1",
        userId: "user-1",
        isArchived: false,
      },
    ];

    await updateNotes({ id: "meeting-1", notes: "Manual notes" });

    expect(fakeDb.update).toHaveBeenCalledTimes(1);
    expect(testState.lastUpdateValues).toEqual({ notes: "Manual notes" });
    expect(auditLogMock.emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        consultationId: "meeting-1",
        action: "meeting.notes_edited",
        entityType: "meeting",
        entityId: "meeting-1",
        metadata: { notes_length: 12 },
      })
    );
  });

  it("rejects archived meetings before writing notes", async () => {
    testState.selectResult = [
      {
        id: "meeting-1",
        userId: "user-1",
        isArchived: true,
      },
    ];

    await expect(updateNotes({ id: "meeting-1", notes: "Manual notes" })).rejects.toThrow(
      "Meeting is archived"
    );

    expect(fakeDb.update).not.toHaveBeenCalled();
    expect(auditLogMock.emitAuditEvent).not.toHaveBeenCalled();
  });
});