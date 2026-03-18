"use server";

import { createClient } from "@/lib/supabase/server";
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
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("evidence_emails")
    .insert({
      consultation_id: consultationId,
      subject,
      body_draft: body,
      status: "draft",
      generated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) throw error;

  await emitAuditEvent({
    consultationId,
    action: AUDIT_ACTIONS.EVIDENCE_EMAIL_GENERATED,
    entityType: "evidence_email",
    entityId: data.id,
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

  return data.id;
}

export async function acceptEmailDraft(
  id: string,
  consultationId: string
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("evidence_emails")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw error;

  await emitAuditEvent({
    consultationId,
    action: AUDIT_ACTIONS.EVIDENCE_EMAIL_ACCEPTED,
    entityType: "evidence_email",
    entityId: id,
  });
}

export async function markEmailSent(id: string, consultationId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("evidence_emails")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw error;

  await emitAuditEvent({
    consultationId,
    action: AUDIT_ACTIONS.EVIDENCE_EMAIL_SENT,
    entityType: "evidence_email",
    entityId: id,
  });
}
