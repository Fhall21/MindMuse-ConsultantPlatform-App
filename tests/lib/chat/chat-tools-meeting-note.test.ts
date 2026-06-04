import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { getMeetingForUser } from "@/lib/data/domain-read";
import {
  insertChatMessage,
  insertToolResult,
  updateChatMessageContent,
} from "@/lib/chat/persist";
import { createChatTools } from "@/lib/chat/tools";

vi.mock("@/db/client", () => ({
  db: {
    update: vi.fn(),
    insert: vi.fn(),
    select: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/data/domain-read", () => ({
  listMeetingsForConsultation: vi.fn(),
  listPeopleForUser: vi.fn(),
  getMeetingForUser: vi.fn(),
  listInsightsForMeeting: vi.fn(),
  listAuditEventsForConsultation: vi.fn(),
}));

vi.mock("@/lib/chat/persist", () => ({
  insertChatMessage: vi.fn(),
  insertToolResult: vi.fn(),
  loadToolResultsForSession: vi.fn(),
  updateChatMessageContent: vi.fn(),
}));

describe("createChatTools attach_meeting_note", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(insertChatMessage).mockResolvedValue({
      id: "message-1",
    } as Awaited<ReturnType<typeof insertChatMessage>>);
    vi.mocked(insertToolResult).mockResolvedValue({
      id: "tool-result-1",
    } as Awaited<ReturnType<typeof insertToolResult>>);
    vi.mocked(updateChatMessageContent).mockResolvedValue();
    const limit = vi.fn().mockResolvedValue([]);
    const whereSelect = vi.fn().mockReturnValue({ limit });
    const leftJoin = vi.fn().mockReturnValue({ where: whereSelect });
    const from = vi.fn().mockReturnValue({ leftJoin });
    vi.mocked(db.select).mockReturnValue({ from } as unknown as ReturnType<typeof db.select>);
  });

  it("appends the note immediately and persists a successful tool result", async () => {
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where });
    vi.mocked(db.update).mockReturnValue({ set } as unknown as ReturnType<typeof db.update>);

    const values = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.insert).mockReturnValue({ values } as unknown as ReturnType<typeof db.insert>);

    vi.mocked(getMeetingForUser).mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      title: "August interview",
      notes: "Existing note",
    } as Awaited<ReturnType<typeof getMeetingForUser>>);

    const tools = createChatTools({
      userId: "user-1",
      sessionId: "22222222-2222-4222-8222-222222222222",
    });
    const execute = tools.attach_meeting_note.execute;
    expect(execute).toBeTypeOf("function");

    const result = await execute?.(
      {
        meeting_id: "11111111-1111-4111-8111-111111111111",
        note: "Follow up on workload.",
      },
      {} as never
    );

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        notes: "Existing note\n\nFollow up on workload.",
      })
    );
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "meeting_note_attached",
        userId: "user-1",
      })
    );
    expect(insertToolResult).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: "attach_meeting_note",
        status: "success",
      })
    );
    expect(result).toMatchObject({
      meeting_title: "August interview",
      tool_result_id: "tool-result-1",
    });
  });
});
