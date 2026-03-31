"use server";

import { randomBytes } from "node:crypto";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { db } from "@/db/client";
import {
  consultationOutputArtifacts,
  reportShareLinks,
  userReportShareSettings,
} from "@/db/schema";
import { getAppSiteUrl } from "@/lib/env";
import { requireCurrentUserId } from "@/lib/data/auth-context";
import { emitAuditEvent, insertAuditLogEntry } from "@/lib/data/audit-log";
import { getRoundOutputArtifactForUser } from "@/lib/data/domain-read";
import { getReportArtifactForUserId } from "@/lib/actions/reports";
import type { ReportArtifactDetail } from "@/types/report-artifact";
import type {
  PublicReportShareMetadata,
  ReportShareLinkListItem,
  UserReportShareSettingsState,
} from "@/types/report-share";

interface CreateReportShareLinkParams {
  artifactId: string;
  consultantName: string | null;
  consultantEmail: string;
  expiresInDays: number;
}

interface AccessSharedReportParams {
  token: string;
  passcode: string;
  request: Request;
}

function toIsoString(value: Date | string | null): string | null {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : value;
}

function buildShareUrl(token: string) {
  return `${getAppSiteUrl()}/share/${token}`;
}

function buildShareToken() {
  return randomBytes(24).toString("base64url");
}

function maskEmail(email: string) {
  const [localPart, domain] = email.split("@");

  if (!localPart || !domain) {
    return "Hidden";
  }

  const maskedLocal = `${localPart[0]}${"*".repeat(Math.max(localPart.length - 1, 2))}`;
  const [domainLabel, ...domainRest] = domain.split(".");
  const maskedDomainLabel = `${domainLabel[0] ?? "*"}${"*".repeat(Math.max(domainLabel.length - 1, 2))}`;

  return `${maskedLocal}@${[maskedDomainLabel, ...domainRest].join(".")}`;
}

function toShareStatus(params: { expiresAt: Date | string; revokedAt: Date | string | null }) {
  if (params.revokedAt) {
    return "revoked" as const;
  }

  const expiry = params.expiresAt instanceof Date
    ? params.expiresAt
    : new Date(params.expiresAt);

  return expiry.getTime() <= Date.now() ? "expired" as const : "active" as const;
}

function mapShareLink(row: {
  id: string;
  token: string;
  consultantName: string | null;
  consultantEmail: string;
  expiresAt: Date | string;
  revokedAt: Date | string | null;
  createdAt: Date | string;
  viewCount: number;
}): ReportShareLinkListItem {
  return {
    id: row.id,
    consultantName: row.consultantName,
    consultantEmail: row.consultantEmail,
    expiresAt: toIsoString(row.expiresAt) ?? new Date(0).toISOString(),
    revokedAt: toIsoString(row.revokedAt),
    createdAt: toIsoString(row.createdAt) ?? new Date(0).toISOString(),
    viewCount: row.viewCount,
    shareUrl: buildShareUrl(row.token),
    status: toShareStatus({
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
    }),
  };
}

async function requireOwnedArtifact(artifactId: string, userId: string) {
  const artifact = await getRoundOutputArtifactForUser(artifactId, userId);

  if (!artifact) {
    throw new Error("Report not found or access denied");
  }

  return artifact;
}

async function getStoredSharePasscodeHash(userId: string) {
  const [settings] = await db
    .select({
      passcodeHash: userReportShareSettings.passcodeHash,
      passcodeUpdatedAt: userReportShareSettings.passcodeUpdatedAt,
    })
    .from(userReportShareSettings)
    .where(eq(userReportShareSettings.userId, userId))
    .limit(1);

  return settings ?? null;
}

async function findActiveShareByToken(token: string) {
  const [share] = await db
    .select({
      id: reportShareLinks.id,
      userId: reportShareLinks.userId,
      artifactId: reportShareLinks.artifactId,
      consultantName: reportShareLinks.consultantName,
      consultantEmail: reportShareLinks.consultantEmail,
      expiresAt: reportShareLinks.expiresAt,
      viewCount: reportShareLinks.viewCount,
      reportTitle: consultationOutputArtifacts.title,
    })
    .from(reportShareLinks)
    .innerJoin(
      consultationOutputArtifacts,
      eq(reportShareLinks.artifactId, consultationOutputArtifacts.id)
    )
    .where(
      and(
        eq(reportShareLinks.token, token),
        isNull(reportShareLinks.revokedAt),
        gt(reportShareLinks.expiresAt, new Date())
      )
    )
    .limit(1);

  return share ?? null;
}

export async function getUserReportShareSettings(): Promise<UserReportShareSettingsState> {
  const userId = await requireCurrentUserId();
  const settings = await getStoredSharePasscodeHash(userId);

  return {
    hasPasscode: Boolean(settings),
    passcodeUpdatedAt: toIsoString(settings?.passcodeUpdatedAt ?? null),
  };
}

export async function updateUserReportSharePasscode(passcode: string) {
  const userId = await requireCurrentUserId();
  const passcodeHash = await hashPassword(passcode);
  const now = new Date();

  const [settings] = await db
    .insert(userReportShareSettings)
    .values({
      userId,
      passcodeHash,
      passcodeUpdatedAt: now,
      updatedBy: userId,
    })
    .onConflictDoUpdate({
      target: userReportShareSettings.userId,
      set: {
        passcodeHash,
        passcodeUpdatedAt: now,
        updatedBy: userId,
        updatedAt: now,
      },
    })
    .returning({
      passcodeUpdatedAt: userReportShareSettings.passcodeUpdatedAt,
    });

  await emitAuditEvent({
    action: "report.share_passcode_updated",
    entityType: "user_report_share_settings",
    entityId: userId,
  });

  return {
    hasPasscode: true,
    passcodeUpdatedAt: toIsoString(settings.passcodeUpdatedAt),
  } satisfies UserReportShareSettingsState;
}

export async function listReportShareLinksForArtifact(
  artifactId: string
): Promise<ReportShareLinkListItem[]> {
  const userId = await requireCurrentUserId();
  await requireOwnedArtifact(artifactId, userId);

  const rows = await db
    .select({
      id: reportShareLinks.id,
      token: reportShareLinks.token,
      consultantName: reportShareLinks.consultantName,
      consultantEmail: reportShareLinks.consultantEmail,
      expiresAt: reportShareLinks.expiresAt,
      revokedAt: reportShareLinks.revokedAt,
      createdAt: reportShareLinks.createdAt,
      viewCount: reportShareLinks.viewCount,
    })
    .from(reportShareLinks)
    .where(
      and(
        eq(reportShareLinks.userId, userId),
        eq(reportShareLinks.artifactId, artifactId)
      )
    )
    .orderBy(desc(reportShareLinks.createdAt));

  return rows.map(mapShareLink);
}

export async function createReportShareLink(
  params: CreateReportShareLinkParams
): Promise<ReportShareLinkListItem> {
  const userId = await requireCurrentUserId();
  const artifact = await requireOwnedArtifact(params.artifactId, userId);
  const settings = await getStoredSharePasscodeHash(userId);

  if (!settings) {
    throw new Error(
      "Set a report share passcode in Settings before creating share links"
    );
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + params.expiresInDays);

  const [share] = await db
    .insert(reportShareLinks)
    .values({
      userId,
      artifactId: params.artifactId,
      token: buildShareToken(),
      consultantName: params.consultantName,
      consultantEmail: params.consultantEmail.toLowerCase(),
      expiresAt,
      createdBy: userId,
    })
    .returning({
      id: reportShareLinks.id,
      token: reportShareLinks.token,
      consultantName: reportShareLinks.consultantName,
      consultantEmail: reportShareLinks.consultantEmail,
      expiresAt: reportShareLinks.expiresAt,
      revokedAt: reportShareLinks.revokedAt,
      createdAt: reportShareLinks.createdAt,
      viewCount: reportShareLinks.viewCount,
    });

  await emitAuditEvent({
    action: "report.share_link_created",
    entityType: "report_share_link",
    entityId: share.id,
    metadata: {
      artifact_id: artifact.id,
      round_id: artifact.consultation_id,
      consultant_email: share.consultantEmail,
      expires_at: toIsoString(share.expiresAt),
    },
  });

  return mapShareLink(share);
}

export async function revokeReportShareLink(artifactId: string, shareId: string) {
  const userId = await requireCurrentUserId();
  await requireOwnedArtifact(artifactId, userId);

  const [share] = await db
    .update(reportShareLinks)
    .set({
      revokedAt: new Date(),
    })
    .where(
      and(
        eq(reportShareLinks.id, shareId),
        eq(reportShareLinks.userId, userId),
        eq(reportShareLinks.artifactId, artifactId),
        isNull(reportShareLinks.revokedAt)
      )
    )
    .returning({
      id: reportShareLinks.id,
      token: reportShareLinks.token,
      consultantName: reportShareLinks.consultantName,
      consultantEmail: reportShareLinks.consultantEmail,
      expiresAt: reportShareLinks.expiresAt,
      revokedAt: reportShareLinks.revokedAt,
      createdAt: reportShareLinks.createdAt,
      viewCount: reportShareLinks.viewCount,
    });

  if (!share) {
    throw new Error("Share link not found or already revoked");
  }

  await emitAuditEvent({
    action: "report.share_link_revoked",
    entityType: "report_share_link",
    entityId: share.id,
    metadata: {
      artifact_id: artifactId,
      consultant_email: share.consultantEmail,
    },
  });

  return mapShareLink(share);
}

export async function getPublicReportShareMetadata(
  token: string
): Promise<PublicReportShareMetadata | null> {
  const share = await findActiveShareByToken(token);

  if (!share) {
    return null;
  }

  return {
    consultantName: share.consultantName,
    consultantEmailHint: maskEmail(share.consultantEmail),
    reportTitle: share.reportTitle ?? null,
    expiresAt: toIsoString(share.expiresAt) ?? new Date(0).toISOString(),
    requiresPasscode: true,
  };
}

export async function accessSharedReport(
  params: AccessSharedReportParams
): Promise<ReportArtifactDetail> {
  const share = await findActiveShareByToken(params.token);

  if (!share) {
    throw new Error("This share link is unavailable");
  }

  const settings = await getStoredSharePasscodeHash(share.userId);

  if (!settings) {
    throw new Error("This share link is unavailable");
  }

  const isValidPasscode = await verifyPassword({
    hash: settings.passcodeHash,
    password: params.passcode,
  });

  if (!isValidPasscode) {
    throw new Error("Incorrect passcode");
  }

  const report = await getReportArtifactForUserId(share.artifactId, share.userId);

  if (!report) {
    throw new Error("This share link is unavailable");
  }

  const forwardedFor =
    params.request.headers.get("x-forwarded-for") ??
    params.request.headers.get("x-real-ip") ??
    null;

  await Promise.all([
    db
      .update(reportShareLinks)
      .set({
        viewCount: sql`${reportShareLinks.viewCount} + 1`,
      })
      .where(eq(reportShareLinks.id, share.id)),
    insertAuditLogEntry({
      userId: share.userId,
      action: "report.share_viewed",
      entityType: "report_share_link",
      entityId: share.id,
      metadata: {
        artifact_id: share.artifactId,
        consultant_email: share.consultantEmail,
        request_ip: forwardedFor,
        user_agent: params.request.headers.get("user-agent"),
      },
    }),
  ]);

  return report;
}