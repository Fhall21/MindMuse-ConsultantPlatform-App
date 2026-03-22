import { beforeEach, describe, expect, it, vi } from "vitest";

const authContextMock = vi.hoisted(() => ({
  requireCurrentUserId: vi.fn(),
}));

const testState = vi.hoisted(() => ({
  selectError: null as unknown,
  updateError: null as unknown,
  insertError: null as unknown,
  deleteError: null as unknown,
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
  select: vi.fn(() => makeSelectBuilder([])),
  update: vi.fn(() => ({
    set: () => ({
      where: async () => {
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
  createReportTemplate,
  deleteReportTemplate,
  getActiveReportTemplate,
  listReportTemplates,
  updateReportTemplate,
} from "@/lib/actions/report-templates";

describe("lib/actions/report-templates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authContextMock.requireCurrentUserId.mockResolvedValue("user-1");
    testState.selectError = null;
    testState.updateError = null;
    testState.insertError = null;
    testState.deleteError = null;
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
});