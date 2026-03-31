"use client";

import { useMemo } from "react";
import type { ReportArtifactDetail } from "@/types/report-artifact";
import {
  buildComplianceAuditTrail,
  getAuditDotColor,
  hasComplianceAuditTrailContent,
  type ComplianceAuditMilestone,
  type ComplianceAuditSession,
} from "@/lib/report-audit";
import { formatShortDate } from "@/lib/report-formatting";
import { cn } from "@/lib/utils";

function AuditRailItem({
  label,
  date,
  dotClassName,
  isLast,
}: {
  label: string;
  date: string;
  dotClassName: string;
  isLast: boolean;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex w-4 flex-col items-center">
        <span
          className={cn(
            "mt-1 size-2 shrink-0 rounded-full",
            dotClassName
          )}
        />
        {!isLast && <span className="mt-1 h-full w-px bg-border/60" />}
      </div>
      <div className="flex-1 pb-3">
        <p className="text-sm text-foreground/85">{label}</p>
        <time className="text-xs text-muted-foreground">
          {formatShortDate(date)}
        </time>
      </div>
    </div>
  );
}

function SessionRail({ sessions }: { sessions: ComplianceAuditSession[] }) {
  if (sessions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Consultation sessions
      </h4>
      <div>
        {sessions.map((session, index) => (
          <AuditRailItem
            key={`${session.title}-${session.date}`}
            label={session.title}
            date={session.date}
            dotClassName="bg-slate-400"
            isLast={index === sessions.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

function MilestoneRail({ milestones }: { milestones: ComplianceAuditMilestone[] }) {
  if (milestones.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Process record
      </h4>
      <div>
        {milestones.map((milestone, index) => (
          <AuditRailItem
            key={`${milestone.action}-${milestone.createdAt}`}
            label={milestone.label}
            date={milestone.createdAt}
            dotClassName={getAuditDotColor(milestone.action)}
            isLast={index === milestones.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

export function AuditTrailSection({ report }: { report: ReportArtifactDetail }) {
  const trail = useMemo(
    () =>
      buildComplianceAuditTrail({
        consultations: report.consultations,
        auditSummary: report.auditSummary ?? [],
      }),
    [report.auditSummary, report.consultations]
  );

  if (!hasComplianceAuditTrailContent(trail)) {
    return null;
  }

  return (
    <section className="space-y-4 print:break-before-page">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Audit Trail
      </h3>
      <div className="space-y-5 rounded-lg border border-border/50 bg-muted/5 px-4 py-4">
        <SessionRail sessions={trail.sessions} />
        <MilestoneRail milestones={trail.milestones} />
      </div>
    </section>
  );
}