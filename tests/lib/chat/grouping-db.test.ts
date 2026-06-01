import { beforeEach, describe, expect, it, vi } from "vitest";

const ownershipMock = vi.hoisted(() => ({
  requireOwnedConsultation: vi.fn(),
}));

const auditMock = vi.hoisted(() => ({
  insertAuditLogEntry: vi.fn(),
}));

const dbState = vi.hoisted(() => ({
  insightRows: [
    { id: "insight-1", meetingId: "meeting-1" },
    { id: "insight-2", meetingId: "meeting-1" },
  ],
  deleteCalls: 0,
  insertThemeMembersCalls: 0,
  insertedThemeId: "group-new",
}));

const fakeTx = vi.hoisted(() => ({
  delete: vi.fn(() => ({
    where: async () => {
      dbState.deleteCalls += 1;
    },
  })),
  insert: vi.fn((table: unknown) => ({
    values: (rows: unknown) => {
      if (Array.isArray(rows)) {
        dbState.insertThemeMembersCalls += 1;
      }
      return {
        returning: async () => [{ id: dbState.insertedThemeId }],
      };
    },
  })),
}));

const fakeDb = vi.hoisted(() => ({
  select: vi.fn(() => ({
    from: () => ({
      innerJoin: () => ({
        where: async () => dbState.insightRows,
      }),
      where: () => ({
        limit: async () => [],
      }),
    }),
  })),
  transaction: vi.fn(async (fn: (tx: typeof fakeTx) => Promise<unknown>) => fn(fakeTx)),
}));

vi.mock("@/db/client", () => ({ db: fakeDb }));
vi.mock("@/lib/data/ownership", () => ownershipMock);
vi.mock("@/lib/data/audit-log", () => auditMock);

import {
  confirmGroupingFromChat,
  ThemeGroupingValidationError,
} from "@/lib/chat/grouping-db";

describe("lib/chat/grouping-db confirmGroupingFromChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbState.deleteCalls = 0;
    dbState.insertThemeMembersCalls = 0;
    dbState.insightRows = [
      { id: "insight-1", meetingId: "meeting-1" },
      { id: "insight-2", meetingId: "meeting-1" },
    ];
    ownershipMock.requireOwnedConsultation.mockResolvedValue({ id: "consult-1" });
  });

  it("removes existing memberships before creating a new group", async () => {
    const result = await confirmGroupingFromChat({
      userId: "user-1",
      consultationId: "consult-1",
      groupName: "Leadership",
      groupDescription: "Leadership themes",
      themeIds: ["insight-1", "insight-2"],
    });

    expect(dbState.deleteCalls).toBe(1);
    expect(dbState.insertThemeMembersCalls).toBe(1);
    expect(result).toEqual({
      id: "group-new",
      name: "Leadership",
      description: "Leadership themes",
      themeIds: ["insight-1", "insight-2"],
    });
    expect(auditMock.insertAuditLogEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        consultationId: "meeting-1",
        entityId: "group-new",
      })
    );
  });

  it("throws when insight ids do not resolve for the consultation", async () => {
    dbState.insightRows = [{ id: "insight-1", meetingId: "meeting-1" }];

    await expect(
      confirmGroupingFromChat({
        userId: "user-1",
        consultationId: "consult-1",
        groupName: "Leadership",
        groupDescription: "",
        themeIds: ["insight-1", "insight-2"],
      })
    ).rejects.toBeInstanceOf(ThemeGroupingValidationError);
  });
});
