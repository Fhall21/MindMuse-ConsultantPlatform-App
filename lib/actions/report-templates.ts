"use server";

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { reportTemplates } from "@/db/schema";
import { requireCurrentUserId } from "@/lib/data/auth-context";
import type {
  ReportTemplate,
  ReportTemplateSection,
  ReportTemplateStyleNotes,
  ReportTemplatePrescriptiveness,
} from "@/types/db";

type ReportTemplateSuggestion = {
  id: string;
  text: string;
  created_at: string;
};

const REPORT_TEMPLATE_MISSING_TABLE_MESSAGE =
  "The database is missing the report template tables. Run the latest database migration, then try again.";

function getErrorText(error: unknown, seen = new Set<unknown>()): string {
  if (!error || typeof error !== "object" || seen.has(error)) return "";

  seen.add(error);

  const record = error as Record<string, unknown>;
  const directText = [record.code, record.message, record.detail, record.details, record.hint]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ");
  const causeText = getErrorText(record.cause, seen);

  return [directText, causeText].filter((value) => value.length > 0).join(" ").toLowerCase();
}

function isMissingReportTemplatesTableError(error: unknown): boolean {
  const text = getErrorText(error);

  return (
    text.includes("report_templates") &&
    (text.includes("42p01") ||
      (text.includes("relation") && text.includes("does not exist")) ||
      text.includes("schema cache"))
  );
}

function normalizeReportTemplatesWriteError(error: unknown): never {
  if (isMissingReportTemplatesTableError(error)) {
    throw new Error(REPORT_TEMPLATE_MISSING_TABLE_MESSAGE);
  }

  throw error;
}

function normalizeTemplateSuggestions(value: unknown): ReportTemplateSuggestion[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;

      const record = entry as Record<string, unknown>;
      const id = typeof record.id === "string" ? record.id : "";
      const text = typeof record.text === "string" ? record.text : "";
      const createdAt =
        typeof record.created_at === "string"
          ? record.created_at
          : typeof record.createdAt === "string"
            ? record.createdAt
            : "";

      if (!id || !text || !createdAt) return null;

      return { id, text, created_at: createdAt };
    })
    .filter((entry): entry is ReportTemplateSuggestion => entry !== null)
    .sort((left, right) => Date.parse(left.created_at) - Date.parse(right.created_at));
}

async function getOwnedReportTemplateRow(templateId: string, userId: string) {
  const [row] = await db
    .select()
    .from(reportTemplates)
    .where(and(eq(reportTemplates.id, templateId), eq(reportTemplates.userId, userId)))
    .limit(1);

  return row;
}

function mapReportTemplateRecord(row: typeof reportTemplates.$inferSelect): ReportTemplate {
  return {
    id: row.id,
    user_id: row.userId,
    name: row.name,
    description: row.description,
    sections: (row.sections ?? []) as ReportTemplateSection[],
    style_notes: (row.styleNotes ?? {}) as ReportTemplateStyleNotes,
    prescriptiveness: row.prescriptiveness as ReportTemplatePrescriptiveness,
    source_file_names: (row.sourceFileNames ?? []) as string[],
    suggestions: normalizeTemplateSuggestions(row.suggestions),
    is_active: row.isActive,
    created_by: row.createdBy,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export async function listReportTemplates(): Promise<ReportTemplate[]> {
  const userId = await requireCurrentUserId();

  try {
    const rows = await db
      .select()
      .from(reportTemplates)
      .where(eq(reportTemplates.userId, userId))
      .orderBy(desc(reportTemplates.createdAt));

    return rows.map(mapReportTemplateRecord);
  } catch (error) {
    if (isMissingReportTemplatesTableError(error)) {
      return [];
    }

    throw error;
  }
}

export async function getReportTemplate(
  templateId: string
): Promise<ReportTemplate | null> {
  const userId = await requireCurrentUserId();

  const [row] = await db
    .select()
    .from(reportTemplates)
    .where(
      and(
        eq(reportTemplates.id, templateId),
        eq(reportTemplates.userId, userId)
      )
    )
    .limit(1);

  return row ? mapReportTemplateRecord(row) : null;
}

export async function getActiveReportTemplate(): Promise<ReportTemplate | null> {
  const userId = await requireCurrentUserId();

  try {
    const [row] = await db
      .select()
      .from(reportTemplates)
      .where(
        and(
          eq(reportTemplates.userId, userId),
          eq(reportTemplates.isActive, true)
        )
      )
      .orderBy(desc(reportTemplates.updatedAt))
      .limit(1);

    return row ? mapReportTemplateRecord(row) : null;
  } catch (error) {
    if (isMissingReportTemplatesTableError(error)) {
      return null;
    }

    throw error;
  }
}

interface CreateReportTemplateParams {
  name: string;
  description?: string | null;
  sections: ReportTemplateSection[];
  styleNotes: ReportTemplateStyleNotes;
  prescriptiveness: ReportTemplatePrescriptiveness;
  sourceFileNames: string[];
}

export async function createReportTemplate(
  params: CreateReportTemplateParams
): Promise<string> {
  const userId = await requireCurrentUserId();

  try {
    // Deactivate any existing active template for this user
    await db
      .update(reportTemplates)
      .set({ isActive: false })
      .where(
        and(
          eq(reportTemplates.userId, userId),
          eq(reportTemplates.isActive, true)
        )
      );

    const [created] = await db
      .insert(reportTemplates)
      .values({
        userId,
        name: params.name,
        description: params.description ?? null,
        sections: params.sections,
        styleNotes: params.styleNotes,
        prescriptiveness: params.prescriptiveness,
        sourceFileNames: params.sourceFileNames,
        suggestions: [],
        isActive: true,
        createdBy: userId,
      })
      .returning({ id: reportTemplates.id });

    return created.id;
  } catch (error) {
    normalizeReportTemplatesWriteError(error);
  }
}

interface UpdateReportTemplateParams {
  id: string;
  name?: string;
  description?: string | null;
  sections?: ReportTemplateSection[];
  styleNotes?: ReportTemplateStyleNotes;
  prescriptiveness?: ReportTemplatePrescriptiveness;
  isActive?: boolean;
}

export async function updateReportTemplate(
  params: UpdateReportTemplateParams
): Promise<void> {
  const userId = await requireCurrentUserId();

  const updates: Record<string, unknown> = {};
  if (params.name !== undefined) updates.name = params.name;
  if (params.description !== undefined) updates.description = params.description;
  if (params.sections !== undefined) updates.sections = params.sections;
  if (params.styleNotes !== undefined) updates.styleNotes = params.styleNotes;
  if (params.prescriptiveness !== undefined) updates.prescriptiveness = params.prescriptiveness;

  try {
    if (params.isActive === true) {
      // Deactivate all others first
      await db
        .update(reportTemplates)
        .set({ isActive: false })
        .where(
          and(
            eq(reportTemplates.userId, userId),
            eq(reportTemplates.isActive, true)
          )
        );
      updates.isActive = true;
    } else if (params.isActive === false) {
      updates.isActive = false;
    }

    if (Object.keys(updates).length === 0) return;

    await db
      .update(reportTemplates)
      .set(updates)
      .where(
        and(
          eq(reportTemplates.id, params.id),
          eq(reportTemplates.userId, userId)
        )
      );
  } catch (error) {
    normalizeReportTemplatesWriteError(error);
  }
}

export async function deleteReportTemplate(templateId: string): Promise<void> {
  const userId = await requireCurrentUserId();

  try {
    await db
      .delete(reportTemplates)
      .where(
        and(
          eq(reportTemplates.id, templateId),
          eq(reportTemplates.userId, userId)
        )
      );
  } catch (error) {
    normalizeReportTemplatesWriteError(error);
  }
}

function normalizeSuggestionText(text: string): string {
  return text.trim();
}

function createSuggestionRecord(text: string): ReportTemplateSuggestion {
  return {
    id: crypto.randomUUID(),
    text,
    created_at: new Date().toISOString(),
  };
}

export async function addTemplateSuggestion(templateId: string, text: string): Promise<void> {
  const userId = await requireCurrentUserId();
  const suggestionText = normalizeSuggestionText(text);

  if (!suggestionText) {
    throw new Error("Suggestion text cannot be empty.");
  }

  try {
    const row = await getOwnedReportTemplateRow(templateId, userId);
    if (!row) {
      throw new Error("Report template not found.");
    }

    const suggestions = normalizeTemplateSuggestions(row.suggestions);
    if (suggestions.length >= 10) {
      throw new Error("A report template can have at most 10 suggestions.");
    }

    const nextSuggestions = [...suggestions, createSuggestionRecord(suggestionText)];

    await db
      .update(reportTemplates)
      .set({ suggestions: nextSuggestions })
      .where(and(eq(reportTemplates.id, templateId), eq(reportTemplates.userId, userId)));
  } catch (error) {
    normalizeReportTemplatesWriteError(error);
  }
}

export async function updateTemplateSuggestion(
  templateId: string,
  suggestionId: string,
  text: string
): Promise<void> {
  const userId = await requireCurrentUserId();
  const suggestionText = normalizeSuggestionText(text);

  if (!suggestionText) {
    throw new Error("Suggestion text cannot be empty.");
  }

  try {
    const row = await getOwnedReportTemplateRow(templateId, userId);
    if (!row) {
      throw new Error("Report template not found.");
    }

    const suggestions = normalizeTemplateSuggestions(row.suggestions);
    const nextSuggestions = suggestions.map((suggestion) =>
      suggestion.id === suggestionId
        ? { ...suggestion, text: suggestionText }
        : suggestion
    );

    await db
      .update(reportTemplates)
      .set({ suggestions: nextSuggestions })
      .where(and(eq(reportTemplates.id, templateId), eq(reportTemplates.userId, userId)));
  } catch (error) {
    normalizeReportTemplatesWriteError(error);
  }
}

export async function removeTemplateSuggestion(
  templateId: string,
  suggestionId: string
): Promise<void> {
  const userId = await requireCurrentUserId();

  try {
    const row = await getOwnedReportTemplateRow(templateId, userId);
    if (!row) {
      throw new Error("Report template not found.");
    }

    const suggestions = normalizeTemplateSuggestions(row.suggestions);
    const nextSuggestions = suggestions.filter((suggestion) => suggestion.id !== suggestionId);

    await db
      .update(reportTemplates)
      .set({ suggestions: nextSuggestions })
      .where(and(eq(reportTemplates.id, templateId), eq(reportTemplates.userId, userId)));
  } catch (error) {
    normalizeReportTemplatesWriteError(error);
  }
}
