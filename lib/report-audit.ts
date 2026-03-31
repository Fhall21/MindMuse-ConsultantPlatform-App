import type { AuditSummaryEvent, ConsultationMeta } from "@/types/report-artifact";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuditCluster {
  label: string;
  count: number;
  action: string;
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

function uniqueLabels(values: string[] = []): string[] {
  const seen = new Set<string>();

  return values.reduce<string[]>((acc, value) => {
    const normalized = value.trim();
    const key = normalized.toLowerCase();

    if (!normalized || seen.has(key)) {
      return acc;
    }

    seen.add(key);
    acc.push(normalized);
    return acc;
  }, []);
}

function formatMeetingTypeLabel(label: string | null): string | null {
  const trimmed = label?.trim();

  if (!trimmed) {
    return null;
  }

  if (/^1-1(\s+interview)?$/i.test(trimmed)) {
    return "1-1";
  }

  if (/^focus\s+group$/i.test(trimmed)) {
    return "Focus group";
  }

  return trimmed;
}

function formatParticipantCount(count: number): string {
  return count === 1 ? "1 person" : `${count} people`;
}

export function buildComplianceSessionLabel(consultation: ConsultationMeta): string {
  const meetingTypeLabel = formatMeetingTypeLabel(consultation.meetingTypeLabel);
  const participantLabels = uniqueLabels(
    consultation.participantLabels ?? consultation.people ?? []
  );
  const participantLabel = participantLabels.join(", ");
  const participantCount = consultation.people?.length ?? 0;
  const countSuffix = participantCount > 0 ? ` (${formatParticipantCount(participantCount)})` : "";

  if (meetingTypeLabel && participantLabel) {
    return `${meetingTypeLabel} with ${participantLabel}${countSuffix}`;
  }

  if (participantLabel) {
    return `${participantLabel}${countSuffix}`;
  }

  return consultation.title;
}

export interface ComplianceAuditTrail {
  sessions: ComplianceAuditSession[];
  milestones: ComplianceAuditMilestone[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COMPLIANCE_MILESTONE_ACTIONS = new Set([
  "evidence_email.sent",
  "round.output_generated",
  "report.manually_edited",
  "round.target_accepted",
]);

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

const COMPLIANCE_MILESTONE_LABELS: Record<string, string> = {
  "evidence_email.sent": "Evidence email sent",
  "round.output_generated": "Report generated",
  "report.manually_edited": "Report revised",
  "round.target_accepted": "Theme validated",
};

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

const TWO_MINUTES_MS = 2 * 60 * 1000;

// ─── Public helpers ───────────────────────────────────────────────────────────

export function buildReportEventLabel(action: string): string {
  return (
    EVENT_LABELS[action] ??
    action
      .split(".")
      .join(" → ")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase())
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
      title: buildComplianceSessionLabel(consultation),
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

export function filterMajorEvents(
  events: AuditSummaryEvent[]
): AuditSummaryEvent[] {
  return events.filter((event) => MAJOR_EVENT_ACTIONS.has(event.action));
}

export function clusterAuditEvents(
  events: AuditSummaryEvent[]
): AuditCluster[] {
  const sorted = [...events].sort(
    (left, right) =>
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
  );

  const clusters: AuditCluster[] = [];

  for (const event of sorted) {
    const eventTime = new Date(event.createdAt).getTime();
    const last = clusters[clusters.length - 1];

    const sameAction = last?.action === event.action;
    const withinWindow =
      last !== undefined &&
      Math.abs(new Date(last.createdAt).getTime() - eventTime) <
        TWO_MINUTES_MS;

    if (last && sameAction && withinWindow) {
      last.count += 1;
      if (eventTime > new Date(last.createdAt).getTime()) {
        last.createdAt = event.createdAt;
      }
      continue;
    }

    clusters.push({
      label: buildReportEventLabel(event.action),
      count: 1,
      action: event.action,
      createdAt: event.createdAt,
    });
  }

  return clusters.reverse();
}
