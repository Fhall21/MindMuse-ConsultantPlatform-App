"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMeetings } from "@/hooks/use-meetings";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import type { Meeting } from "@/types/db";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function StatusBadge({ status }: { status: string }) {
  if (status === "complete") {
    return (
      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Complete</Badge>
    );
  }
  return <Badge variant="secondary">Draft</Badge>;
}

function MetricValue({
  label,
  value,
  description,
  isLoading,
  isError,
}: {
  label: string;
  value: number;
  description: string;
  isLoading: boolean;
  isError: boolean;
}) {
  return (
    <div className="space-y-1 sm:border-l sm:pl-6 first:sm:border-l-0 first:sm:pl-0">
      <dt className="text-sm font-medium text-foreground">{label}</dt>
      <dd className="text-sm text-muted-foreground">{description}</dd>
      <dd className="pt-1 text-4xl font-semibold tracking-tight">
        {isLoading ? (
          <Skeleton className="h-10 w-16" />
        ) : isError ? (
          "—"
        ) : (
          value.toLocaleString()
        )}
      </dd>
    </div>
  );
}

function RecentConsultationRow({ consultation }: { consultation: Meeting }) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="min-w-0 flex-1">
        <Link
          href={`/meetings/${consultation.id}`}
          className="truncate text-sm font-medium hover:underline"
        >
          {consultation.title}
        </Link>
        <p className="text-xs text-muted-foreground">{formatDate(consultation.created_at)}</p>
      </div>
      <div className="ml-4 flex-shrink-0">
        <StatusBadge status={consultation.status} />
      </div>
    </div>
  );
}

function RecentConsultationsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between py-3">
          <div className="space-y-1">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="border border-dashed px-6 py-10 text-center">
      <p className="text-sm text-muted-foreground">No consultations yet.</p>
      <Button asChild size="sm" className="mt-4">
        <Link href="/meetings/new">New Meeting</Link>
      </Button>
    </div>
  );
}

export default function DashboardPage() {
  const consultationsQuery = useMeetings();
  const statsQuery = useDashboardStats();

  const recentConsultations = (consultationsQuery.data ?? []).slice(0, 10);
  const isConsultationsLoading = consultationsQuery.isLoading;
  const hasNoConsultations = !isConsultationsLoading && recentConsultations.length === 0;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Current workspace activity.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm">
          <Link href="/meetings/new">New Meeting</Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/people">People</Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/reports">Reports</Link>
        </Button>
      </div>

      <dl className="grid gap-4 border-y py-4 sm:grid-cols-3 sm:gap-6">
        <MetricValue
          label="Consultations"
          value={statsQuery.data?.totalConsultations ?? 0}
          description="Recorded consultations"
          isLoading={statsQuery.isLoading}
          isError={statsQuery.isError}
        />
        <MetricValue
          label="People"
          value={statsQuery.data?.totalPeople ?? 0}
          description="Linked people"
          isLoading={statsQuery.isLoading}
          isError={statsQuery.isError}
        />
        <MetricValue
          label="Evidence Emails"
          value={statsQuery.data?.emailsSent ?? 0}
          description="Drafted or sent"
          isLoading={statsQuery.isLoading}
          isError={statsQuery.isError}
        />
      </dl>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight">Recent consultations</h2>
          <Button asChild variant="ghost" size="sm" className="text-xs">
            <Link href="/meetings">View all →</Link>
          </Button>
        </div>

        {isConsultationsLoading ? (
          <RecentConsultationsSkeleton />
        ) : hasNoConsultations ? (
          <EmptyState />
        ) : (
          <div className="divide-y border-t">
            {recentConsultations.map((consultation) => (
              <div key={consultation.id} className="px-1">
                <RecentConsultationRow consultation={consultation} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
