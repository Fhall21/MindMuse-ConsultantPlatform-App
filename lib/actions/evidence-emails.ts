"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { evidenceEmails } from "@/db/schema";
import { requireCurrentUserId } from "@/lib/data/auth-context";
import { requireOwnedConsultation } from "@/lib/data/ownership";
import { AUDIT_ACTIONS } from "./audit-actions";
import { emitAuditEvent } from "./audit";

interface EmailThemeSelection {
  label: string;
  sourceKinds: Array<"consultation" | "round">;
  provenance: Array<{
    consultationId: string | null;
    consultationTitle: string | null;
    roundId: string | null;
    roundLabel: string | null;
    isUserAdded: boolean;
  }>;
}

interface SaveEmailDraftParams {
  consultationId: string;
  subject: string;
  body: string;
  themeSelections?: EmailThemeSelection[];
}

export async function saveEmailDraft({
  consultationId,
  subject,
  body,
  themeSelections,
}: SaveEmailDraftParams) {
  const userId = await requireCurrentUserId();
  await requireOwnedConsultation(consultationId, userId);

  const [created] = await db
    .insert(evidenceEmails)
    .values({
      consultationId,
      subject,
      bodyDraft: body,
      status: "draft",
      generatedAt: new Date(),
    })
    .returning({ id: evidenceEmails.id });

  await emitAuditEvent({
    consultationId,
    action: AUDIT_ACTIONS.EVIDENCE_EMAIL_GENERATED,
    entityType: "evidence_email",
    entityId: created.id,
    metadata: {
      subjectLength: subject.length,
      bodyLength: body.length,
      themeSelections: themeSelections ?? [],
      includedThemeCount: themeSelections?.length ?? 0,
      roundThemeCount:
        themeSelections?.filter((theme) => theme.sourceKinds.includes("round"))
          .length ?? 0,
    },
  });

  return created.id;
}

export async function acceptEmailDraft(
  id: string,
  consultationId: string
) {
  const userId = await requireCurrentUserId();
  await requireOwnedConsultation(consultationId, userId);

  await db
    .update(evidenceEmails)
    .set({
      status: "accepted",
      acceptedAt: new Date(),
    })
    .where(and(eq(evidenceEmails.id, id), eq(evidenceEmails.consultationId, consultationId)));

  await emitAuditEvent({
    consultationId,
    action: AUDIT_ACTIONS.EVIDENCE_EMAIL_ACCEPTED,
    entityType: "evidence_email",
    entityId: id,
  });
}

export async function markEmailSent(id: string, consultationId: string) {
  const userId = await requireCurrentUserId();
  await requireOwnedConsultation(consultationId, userId);

  await db
    .update(evidenceEmails)
    .set({
      status: "sent",
      sentAt: new Date(),
    })
    .where(and(eq(evidenceEmails.id, id), eq(evidenceEmails.consultationId, consultationId)));

  await emitAuditEvent({
    consultationId,
    action: AUDIT_ACTIONS.EVIDENCE_EMAIL_SENT,
    entityType: "evidence_email",
    entityId: id,
  });
}
