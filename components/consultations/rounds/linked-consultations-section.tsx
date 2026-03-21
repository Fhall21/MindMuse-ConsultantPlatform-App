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
  consultations: RoundConsultationSummary[];
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
  consultations,
}: LinkedConsultationsSectionProps) {
  if (consultations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Linked Consultations</CardTitle>
          <CardDescription>
            No consultations assigned to this round yet.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Linked Consultations</CardTitle>
        <CardDescription>
          {consultations.length} consultation{consultations.length !== 1 ? "s" : ""} in this round
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {consultations.map((c) => {
          const emailLabel = emailStatusLabel(c.evidenceEmailStatus);

          return (
            <div key={c.id} className="rounded-md border">
              {/* Row */}
              <div className="flex items-center justify-between px-3 py-2.5 gap-2">
                {/* Left: name pill + meta */}
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/meetings/${c.id}`}
                      className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground"
                    >
                      {c.title}
                    </Link>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {c.themeCount} theme{c.themeCount !== 1 ? "s" : ""}
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
                  <Badge variant={statusBadgeVariant(c.status)}>{c.status}</Badge>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
