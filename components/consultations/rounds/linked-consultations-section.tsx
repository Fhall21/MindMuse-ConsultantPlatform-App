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
      <CardContent className="space-y-2">
        {meetings.map((meeting) => {
          const emailLabel = emailStatusLabel(meeting.evidenceEmailStatus);

          return (
            <div key={meeting.id} className="rounded-md border border-border/50 bg-muted/5">
              {/* Row */}
              <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                {/* Left: name pill + meta */}
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/meetings/${meeting.id}`}
                      className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground"
                    >
                      {meeting.title}
                    </Link>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {meeting.themeCount} theme{meeting.themeCount !== 1 ? "s" : ""}
                    </span>
                    {emailLabel ? (
                      <span className="text-xs text-muted-foreground">
                        &middot; {emailLabel}
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Right: status badge */}
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={statusBadgeVariant(meeting.status)}>{meeting.status}</Badge>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
