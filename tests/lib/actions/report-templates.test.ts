import { beforeEach, describe, expect, it, vi } from "vitest";

const authContextMock = vi.hoisted(() => ({
  requireCurrentUserId: vi.fn(),
}));

const testState = vi.hoisted(() => ({
  selectError: null as unknown,
  updateError: null as unknown,
  insertError: null as unknown,
  deleteError: null as unknown,
  selectResult: [] as unknown[],
  lastUpdateValues: null as Record<string, unknown> | null,
}));

function makeMissingTableError() {
  return {
    message: "Failed query",
    cause: {
      code: "42P01",
      message: 'relation "report_templates" does not exist',
      detail: undefined,
      hint: undefined,
    },
  };
}

function makeSelectBuilder(result: unknown[]) {
  const builder: Record<string, unknown> = {
    from: () => builder,
    where: () => builder,
    orderBy: () => builder,
    limit: () => builder,
    then: (resolve: (value: unknown[]) => void, reject: (reason?: unknown) => void) => {
      if (testState.selectError) {
        return Promise.reject(testState.selectError).then(resolve, reject);
      }

      return Promise.resolve(result).then(resolve, reject);
    },
  };

  return builder;
}

const fakeDb = vi.hoisted(() => ({
  select: vi.fn(() => makeSelectBuilder(testState.selectResult)),
  update: vi.fn(() => ({
    set: (values: Record<string, unknown>) => ({
      where: async () => {
        testState.lastUpdateValues = values;
        if (testState.updateError) {
          throw testState.updateError;
        }

        return undefined;
      },
    }),
  })),
  insert: vi.fn(() => ({
    values: () => ({
      returning: async () => {
        if (testState.insertError) {
          throw testState.insertError;
        }

        return [{ id: "template-1" }];
      },
    }),
  })),
  delete: vi.fn(() => ({
    where: async () => {
      if (testState.deleteError) {
        throw testState.deleteError;
      }

      return undefined;
    },
  })),
}));

vi.mock("@/db/client", () => ({
  db: fakeDb,
}));
vi.mock("@/lib/data/auth-context", () => authContextMock);

import {
  addTemplateSuggestion,
  createReportTemplate,
  deleteReportTemplate,
  getActiveReportTemplate,
  listReportTemplates,
  removeTemplateSuggestion,
  updateReportTemplate,
  updateTemplateSuggestion,
} from "@/lib/actions/report-templates";

function makeTemplateRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "template-1",
    userId: "user-1",
    name: "Example",
    description: null,
    sections: [],
    styleNotes: {},
    prescriptiveness: "moderate",
    sourceFileNames: [],
    suggestions: [],
    isActive: true,
    createdBy: "user-1",
    createdAt: new Date("2026-03-30T00:00:00.000Z"),
    updatedAt: new Date("2026-03-30T00:00:00.000Z"),
    ...overrides,
  };
}

describe("lib/actions/report-templates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authContextMock.requireCurrentUserId.mockResolvedValue("user-1");
    testState.selectError = null;
    testState.updateError = null;
    testState.insertError = null;
    testState.deleteError = null;
    testState.selectResult = [];
    testState.lastUpdateValues = null;
  });

  it("returns an empty list when the report_templates table is missing", async () => {
    testState.selectError = makeMissingTableError();

    await expect(listReportTemplates()).resolves.toEqual([]);
  });

  it("returns null when the active report template table is missing", async () => {
    testState.selectError = makeMissingTableError();

    await expect(getActiveReportTemplate()).resolves.toBeNull();
  });

  it("normalizes missing table errors for create, update, and delete", async () => {
    testState.updateError = makeMissingTableError();

    await expect(
      createReportTemplate({
        name: "Example",
        sections: [],
        styleNotes: { tone: null, person: null, formatting_notes: null },
        prescriptiveness: "moderate",
        sourceFileNames: [],
      })
    ).rejects.toThrow(
      "The database is missing the report template tables. Run the latest database migration, then try again."
    );

    testState.updateError = makeMissingTableError();

    await expect(
      updateReportTemplate({ id: "template-1", isActive: true })
    ).rejects.toThrow(
      "The database is missing the report template tables. Run the latest database migration, then try again."
    );

    testState.deleteError = makeMissingTableError();

    await expect(deleteReportTemplate("template-1")).rejects.toThrow(
      "The database is missing the report template tables. Run the latest database migration, then try again."
    );
  });

  it("adds, updates, and removes template suggestions", async () => {
    testState.selectResult = [
      makeTemplateRow({
        suggestions: [
          {
            id: "s-1",
            text: "First note",
            created_at: "2026-03-30T00:00:00.000Z",
          },
        ],
      }),
    ];

    await addTemplateSuggestion("template-1", "  Second note  ");

    expect(testState.lastUpdateValues?.suggestions).toEqual([
      {
        id: "s-1",
        text: "First note",
        created_at: "2026-03-30T00:00:00.000Z",
      },
      expect.objectContaining({ text: "Second note" }),
    ]);

    testState.selectResult = [
      makeTemplateRow({
        suggestions: [
          {
            id: "s-1",
            text: "First note",
            created_at: "2026-03-30T00:00:00.000Z",
          },
          {
            id: "s-2",
            text: "Second note",
            created_at: "2026-03-30T00:01:00.000Z",
          },
        ],
      }),
    ];

    await updateTemplateSuggestion("template-1", "s-2", "Updated note");

    expect(testState.lastUpdateValues?.suggestions).toEqual([
      {
        id: "s-1",
        text: "First note",
        created_at: "2026-03-30T00:00:00.000Z",
      },
      {
        id: "s-2",
        text: "Updated note",
        created_at: "2026-03-30T00:01:00.000Z",
      },
    ]);

    await removeTemplateSuggestion("template-1", "s-1");

    expect(testState.lastUpdateValues?.suggestions).toEqual([
      {
        id: "s-2",
        text: "Second note",
        created_at: "2026-03-30T00:01:00.000Z",
      },
    ]);
  });

  it("rejects adding more than 10 guidance notes", async () => {
    testState.selectResult = [
      makeTemplateRow({
        suggestions: Array.from({ length: 10 }, (_, index) => ({
          id: `s-${index + 1}`,
          text: `Note ${index + 1}`,
          created_at: `2026-03-30T00:${String(index).padStart(2, "0")}:00.000Z`,
        })),
      }),
    ];

    await expect(addTemplateSuggestion("template-1", "Another note")).rejects.toThrow(
      "A report template can have at most 10 suggestions."
    );
  });
});