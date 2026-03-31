import type {
  AuditSummaryEvent,
  ConsultationMeta,
} from "@/types/report-artifact";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuditCluster {
  /** Human-readable label for the cluster */
  label: string;
  /** Number of events merged into this cluster */
  count: number;
  /** The primary action (used for dot colour) */
  action: string;
  /** Most recent event timestamp in the cluster */
  createdAt: string;
}

export interface ComplianceAuditSession {
  title: string;
  date: string;
}

export interface ComplianceAuditMilestone {
  action: string;
  label: string;
  count: number;
  createdAt: string;
}

export interface ComplianceAuditTrail {
  sessions: ComplianceAuditSession[];
  milestones: ComplianceAuditMilestone[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Only these lifecycle events appear in the report audit trail.
 * Micro-actions (edits, label tweaks, group renames) are intentionally excluded.
 */
const MAJOR_EVENT_ACTIONS = new Set([
  "consultation.created",
  "consultation.completed",
  "consultation.round_assigned",
  "round.created",
  "round.output_generated",
  "round.target_accepted",
  "round.target_discarded",
  "transcript.file_uploaded",
  "transcript.parsed",
  "audio.uploaded",
  "audio.transcription_completed",
  "theme.accepted",
  "theme.rejected",
  "evidence_email.generated",
  "evidence_email.sent",
  "report.manually_edited",
]);

const EVENT_LABELS: Record<string, string> = {
  "consultation.created": "Consultation created",
  "consultation.completed": "Consultation marked complete",
  "consultation.round_assigned": "Assigned to consultation",
  "round.created": "Consultation created",
  "round.output_generated": "Consultation output generated",
  "round.target_accepted": "Theme group accepted",
  "round.target_discarded": "Theme group discarded",
  "transcript.file_uploaded": "Transcript uploaded",
  "transcript.parsed": "Transcript parsed",
  "audio.uploaded": "Audio file uploaded",
  "audio.transcription_completed": "Audio transcription completed",
  "theme.accepted": "Theme accepted",
  "theme.rejected": "Theme rejected",
  "evidence_email.generated": "Evidence email generated",
  "evidence_email.sent": "Evidence email sent",
  "report.manually_edited": "Report manually edited",
};

const COMPLIANCE_MILESTONE_ACTIONS = new Set([
  "evidence_email.sent",
  "round.output_generated",
  "report.manually_edited",
  "round.target_accepted",
]);

const COMPLIANCE_MILESTONE_LABELS: Record<string, string> = {
  "evidence_email.sent": "Evidence email sent",
  "round.output_generated": "Report generated",
  "report.manually_edited": "Report revised",
  "round.target_accepted": "Theme validated",
};

/** Events within this window sharing the same action prefix are merged into one cluster */
const TWO_MINUTES_MS = 2 * 60 * 1000;

// ─── Public helpers ───────────────────────────────────────────────────────────

export function buildReportEventLabel(action: string): string {
  return (
    EVENT_LABELS[action] ??
    action
      .split(".")
      .join(" → ")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export function getAuditDotColor(action: string): string {
  if (action.startsWith("consultation.")) return "bg-slate-400";
  if (action.startsWith("theme.")) return "bg-emerald-500";
  if (action.startsWith("person.")) return "bg-amber-500";
  if (action.startsWith("evidence_email.")) return "bg-sky-500";
  if (action.startsWith("round.")) return "bg-violet-500";
  if (action.startsWith("report.")) return "bg-orange-500";
  if (
    action.startsWith("transcript.") ||
    action.startsWith("audio.") ||
    action.startsWith("ocr.")
  )
    return "bg-teal-500";
  return "bg-muted-foreground/40";
}

export function buildComplianceAuditTrail(params: {
  consultations: ConsultationMeta[];
  auditSummary: AuditSummaryEvent[];
}): ComplianceAuditTrail {
  const sessions = [...params.consultations]
    .filter((consultation) => consultation.date)
    .sort((left, right) => right.date.localeCompare(left.date))
    .map((consultation) => ({
      title: consultation.title,
      date: consultation.date,
    }));

  const acceptedEvents = params.auditSummary.filter(
    (event) => event.action === "round.target_accepted"
  );
  const otherMilestones = params.auditSummary.filter(
    (event) =>
      COMPLIANCE_MILESTONE_ACTIONS.has(event.action) &&
      event.action !== "round.target_accepted"
  );

  const milestones: ComplianceAuditMilestone[] = [];

  if (acceptedEvents.length > 0) {
    const mostRecent = acceptedEvents.reduce((latest, event) =>
      latest.createdAt > event.createdAt ? latest : event
    );

    milestones.push({
      action: "round.target_accepted",
      label:
        acceptedEvents.length === 1
          ? "1 theme validated"
          : `${acceptedEvents.length} themes validated`,
      count: acceptedEvents.length,
      createdAt: mostRecent.createdAt,
    });
  }

  for (const event of otherMilestones) {
    milestones.push({
      action: event.action,
      label: COMPLIANCE_MILESTONE_LABELS[event.action] ?? event.action,
      count: 1,
      createdAt: event.createdAt,
    });
  }

  milestones.sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  return { sessions, milestones };
}

export function hasComplianceAuditTrailContent(
  trail: ComplianceAuditTrail
): boolean {
  return trail.sessions.length > 0 || trail.milestones.length > 0;
}

/** Remove micro-actions, keeping only major lifecycle milestones */
export function filterMajorEvents(
  events: AuditSummaryEvent[]
): AuditSummaryEvent[] {
  return events.filter((e) => MAJOR_EVENT_ACTIONS.has(e.action));
}

/**
 * Cluster events that share the same action-namespace prefix and fall within
 * a 2-minute window into a single entry.
 *
 * Example: 4× "round.target_accepted" within 90 s → one cluster, count = 4.
 *
 * Input order is not assumed. Returns newest-first for display.
 */
export function clusterAuditEvents(
  events: AuditSummaryEvent[]
): AuditCluster[] {
  // Sort ascending so adjacent events are processed in chronological order
  const sorted = [...events].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const clusters: AuditCluster[] = [];

  for (const event of sorted) {
    const eventTime = new Date(event.createdAt).getTime();
    const actionPrefix = event.action;
    const last = clusters[clusters.length - 1];

    const samePrefix = last?.action === actionPrefix;
    const withinWindow =
      last !== undefined &&
      Math.abs(new Date(last.createdAt).getTime() - eventTime) <
        TWO_MINUTES_MS;

    if (last && samePrefix && withinWindow) {
      last.count++;
      // Advance timestamp to the most recent event in the cluster
      if (eventTime > new Date(last.createdAt).getTime()) {
        last.createdAt = event.createdAt;
      }
    } else {
      clusters.push({
        label: buildReportEventLabel(event.action),
        count: 1,
        action: event.action,
        createdAt: event.createdAt,
      });
    }
  }

  // Reverse to show newest first
  return clusters.reverse();
}
