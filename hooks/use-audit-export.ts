"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { createClient } from "@/lib/supabase/client";
import { generateAuditExport } from "@/lib/actions/audit-export";
import type { AuditExportFilters, AuditExportFormat, AuditExportPackage } from "@/types/db";

export interface AuditExportUserOption {
  id: string;
  label: string;
}

interface ExportAuditParams {
  format: AuditExportFormat;
  filters: AuditExportFilters;
}

function escapeCsvValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue =
    typeof value === "string" ? value : JSON.stringify(value, null, 0);

  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }

  return stringValue;
}

function downloadBlob(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();

  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 1000);
}

function serializeAuditExportAsCsv(exportPackage: AuditExportPackage) {
  const header = [
    "consultation_id",
    "consultation_title",
    "round_label",
    "consultation_status",
    "consultation_created_at",
    "consultation_updated_at",
    "event_id",
    "event_timestamp",
    "event_action",
    "event_label",
    "lifecycle_stage",
    "event_user_id",
    "entity_type",
    "entity_id",
    "theme_count",
    "accepted_theme_count",
    "rejected_theme_count",
    "evidence_email_count",
    "latest_evidence_email_status",
    "evidence_email_generated_at",
    "evidence_email_accepted_at",
    "evidence_email_sent_at",
    "payload_json",
  ];

  const rows = exportPackage.consultations.flatMap((consultation) =>
    consultation.chronology.map((event) => [
      consultation.consultationId,
      consultation.title,
      consultation.roundLabel,
      consultation.status,
      consultation.createdAt,
      consultation.updatedAt,
      event.id,
      event.timestamp,
      event.action,
      event.label,
      event.lifecycleStage,
      event.userId,
      event.entityType,
      event.entityId,
      consultation.artifactSummary.themeCount,
      consultation.artifactSummary.acceptedThemeCount,
      consultation.artifactSummary.rejectedThemeCount,
      consultation.artifactSummary.evidenceEmailCount,
      consultation.artifactSummary.latestEvidenceEmailStatus,
      consultation.artifactSummary.evidenceEmailGeneratedAt,
      consultation.artifactSummary.evidenceEmailAcceptedAt,
      consultation.artifactSummary.evidenceEmailSentAt,
      event.payload ? JSON.stringify(event.payload) : null,
    ])
  );

  const csv = [header, ...rows]
    .map((row) => row.map((cell) => escapeCsvValue(cell)).join(","))
    .join("\n");

  return new Blob([csv], { type: "text/csv;charset=utf-8" });
}

function serializeAuditExportAsJson(exportPackage: AuditExportPackage) {
  return new Blob([JSON.stringify(exportPackage, null, 2)], {
    type: "application/json;charset=utf-8",
  });
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function wrapText(text: string, maxCharacters: number) {
  const paragraphs = text.split("\n");
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);

    if (words.length === 0) {
      lines.push("");
      continue;
    }

    let currentLine = "";

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (candidate.length <= maxCharacters) {
        currentLine = candidate;
        continue;
      }

      if (currentLine) {
        lines.push(currentLine);
      }

      currentLine = word;
    }

    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines;
}

async function serializeAuditExportAsPdf(exportPackage: AuditExportPackage) {
  const pdf = await PDFDocument.create();
  const regularFont = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([595.28, 841.89]);
  let y = page.getHeight() - 40;
  const marginX = 40;
  const bottomMargin = 40;

  function ensureSpace(height: number) {
    if (y - height >= bottomMargin) {
      return;
    }

    page = pdf.addPage([595.28, 841.89]);
    y = page.getHeight() - 40;
  }

  function drawTextBlock(
    text: string,
    options: { size?: number; bold?: boolean; gapAfter?: number; maxCharacters?: number } = {}
  ) {
    const size = options.size ?? 10;
    const lineHeight = size + 4;
    const lines = wrapText(text, options.maxCharacters ?? 92);

    ensureSpace(lines.length * lineHeight);

    for (const line of lines) {
      page.drawText(line, {
        x: marginX,
        y,
        size,
        font: options.bold ? boldFont : regularFont,
      });
      y -= lineHeight;
    }

    y -= options.gapAfter ?? 4;
  }

  drawTextBlock("Compliance Audit Export", {
    size: 18,
    bold: true,
    gapAfter: 6,
  });
  drawTextBlock(`Generated: ${formatDateTime(exportPackage.generatedAt)}`, { gapAfter: 12 });
  drawTextBlock(
    `Filters: Date ${exportPackage.filters.dateFrom ?? "Any"} to ${
      exportPackage.filters.dateTo ?? "Any"
    } | Consultation ${exportPackage.filters.consultationId ?? "All"} | User ${
      exportPackage.filters.userId ?? "All"
    }`,
    { gapAfter: 10 }
  );
  drawTextBlock(
    `Summary: ${exportPackage.summary.consultationCount} consultation groups, ${exportPackage.summary.eventCount} events, ${exportPackage.summary.userCount} users.`,
    { gapAfter: 14 }
  );

  if (exportPackage.consultations.length === 0) {
    drawTextBlock("No audit events matched the selected filters.", { gapAfter: 0 });
  }

  for (const consultation of exportPackage.consultations) {
    drawTextBlock(consultation.title, {
      size: 13,
      bold: true,
      gapAfter: 4,
      maxCharacters: 84,
    });
    drawTextBlock(
      `Consultation ID: ${consultation.consultationId ?? "Unlinked"} | Round: ${
        consultation.roundLabel ?? "-"
      } | Status: ${consultation.status ?? "-"} | User: ${consultation.userId ?? "-"}`,
      { gapAfter: 2 }
    );
    drawTextBlock(
      `Created: ${formatDateTime(consultation.createdAt)} | Updated: ${formatDateTime(
        consultation.updatedAt
      )}`,
      { gapAfter: 8 }
    );
    drawTextBlock(
      `Artifacts: ${consultation.artifactSummary.themeCount} themes (${consultation.artifactSummary.acceptedThemeCount} accepted, ${consultation.artifactSummary.rejectedThemeCount} rejected), ${consultation.artifactSummary.evidenceEmailCount} evidence emails, latest email status ${consultation.artifactSummary.latestEvidenceEmailStatus ?? "not recorded"}.`,
      { gapAfter: 8 }
    );

    if (consultation.lifecycleMarkers.length > 0) {
      drawTextBlock("Lifecycle markers", {
        bold: true,
        gapAfter: 2,
      });

      for (const marker of consultation.lifecycleMarkers) {
        drawTextBlock(
          `${formatDateTime(marker.timestamp)} | ${marker.label} | ${marker.userId}`,
          { gapAfter: 0, maxCharacters: 88 }
        );
      }

      y -= 6;
    }

    drawTextBlock("Chronology", {
      bold: true,
      gapAfter: 2,
    });

    for (const event of consultation.chronology) {
      drawTextBlock(
        `${formatDateTime(event.timestamp)} | ${event.label} | ${event.userId}`,
        { gapAfter: 0, maxCharacters: 88 }
      );

      if (event.payload) {
        drawTextBlock(`Payload: ${JSON.stringify(event.payload)}`, {
          size: 9,
          gapAfter: 0,
          maxCharacters: 96,
        });
      }
    }

    y -= 10;
  }

  const bytes = await pdf.save();
  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;

  return new Blob([arrayBuffer], { type: "application/pdf" });
}

async function buildExportBlob(format: AuditExportFormat, exportPackage: AuditExportPackage) {
  switch (format) {
    case "csv":
      return serializeAuditExportAsCsv(exportPackage);
    case "json":
      return serializeAuditExportAsJson(exportPackage);
    case "pdf":
      return serializeAuditExportAsPdf(exportPackage);
    default:
      throw new Error(`Unsupported export format: ${format satisfies never}`);
  }
}

export function useAuditExportUsers() {
  return useQuery({
    queryKey: ["audit-export", "users"],
    queryFn: async () => {
      const supabase = createClient();
      const [{ data: auditRows, error }, userResult] = await Promise.all([
        supabase
          .from("audit_log")
          .select("user_id")
          .order("created_at", { ascending: false })
          .limit(1000),
        supabase.auth.getUser(),
      ]);

      if (error) {
        throw error;
      }

      const visibleUserIds = Array.from(
        new Set((auditRows ?? []).map((row) => row.user_id).filter(Boolean))
      );
      const currentUserId = userResult.data.user?.id ?? null;
      const currentUserEmail = userResult.data.user?.email ?? "Current user";

      return visibleUserIds.map<AuditExportUserOption>((userId) => ({
        id: userId,
        label: userId === currentUserId ? `${currentUserEmail} (me)` : userId,
      }));
    },
  });
}

export function useAuditExport() {
  const mutation = useMutation({
    mutationFn: async ({ format, filters }: ExportAuditParams) => {
      const exportPackage = await generateAuditExport(filters);
      const blob = await buildExportBlob(format, exportPackage);
      const filename = `${exportPackage.filenameBase}.${format}`;

      downloadBlob(blob, filename);

      return exportPackage;
    },
  });

  return {
    exportAudit: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
    lastExport: mutation.data ?? null,
    reset: mutation.reset,
  };
}
