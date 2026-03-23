"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { RoundConsultationSummary } from "@/types/round-detail";

interface LinkedConsultationsSectionProps {
  meetings: RoundConsultationSummary[];
}

function statusBadgeVariant(status: string) {
  if (status === "complete") return "default" as const;
  return "secondary" as const;
}

function emailStatusLabel(status: string | null) {
  if (!status) return null;
  if (status === "sent") return "Email sent";
  if (status === "accepted") return "Email ready";
  if (status === "draft") return "Email draft";
  return null;
}

export function LinkedConsultationsSection({
  meetings,
}: LinkedConsultationsSectionProps) {
  if (meetings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Linked Meetings</CardTitle>
          <CardDescription>
            No meetings assigned to this consultation yet.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Linked Meetings</CardTitle>
        <CardDescription>
          {meetings.length} meeting{meetings.length !== 1 ? "s" : ""} in this consultation
        </CardDescription>
      </CardHeader>
      <CardContent className="divide-y divide-border/60">
        {meetings.map((meeting) => {
          const emailLabel = emailStatusLabel(meeting.evidenceEmailStatus);

          return (
            <div key={meeting.id} className="py-3 first:pt-0 last:pb-0">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/meetings/${meeting.id}`}
                    className="text-sm font-medium text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    {meeting.title}
                  </Link>
                  <Badge variant={statusBadgeVariant(meeting.status)}>{meeting.status}</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    {meeting.themeCount} theme{meeting.themeCount !== 1 ? "s" : ""}
                  </span>
                  {emailLabel ? <span>{emailLabel}</span> : null}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
