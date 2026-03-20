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
    is_active: row.isActive,
    created_by: row.createdBy,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export async function listReportTemplates(): Promise<ReportTemplate[]> {
  const userId = await requireCurrentUserId();

  const rows = await db
    .select()
    .from(reportTemplates)
    .where(eq(reportTemplates.userId, userId))
    .orderBy(desc(reportTemplates.createdAt));

  return rows.map(mapReportTemplateRecord);
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
      isActive: true,
      createdBy: userId,
    })
    .returning({ id: reportTemplates.id });

  return created.id;
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
}

export async function deleteReportTemplate(templateId: string): Promise<void> {
  const userId = await requireCurrentUserId();

  await db
    .delete(reportTemplates)
    .where(
      and(
        eq(reportTemplates.id, templateId),
        eq(reportTemplates.userId, userId)
      )
    );
}
