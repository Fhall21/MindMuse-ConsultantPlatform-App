"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useConsultations } from "@/hooks/use-consultations";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import type { Consultation } from "@/types/db";

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

function MetricCard({
  title,
  value,
  description,
  isLoading,
  isError,
}: {
  title: string;
  value: number;
  description: string;
  isLoading: boolean;
  isError: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-16" />
        ) : isError ? (
          <p className="text-sm text-muted-foreground">—</p>
        ) : (
          <p className="text-3xl font-bold">{value.toLocaleString()}</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function RecentConsultationRow({ consultation }: { consultation: Consultation }) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="min-w-0 flex-1">
        <Link
          href={`/consultations/${consultation.id}`}
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
    <div className="rounded-lg border border-dashed p-10 text-center">
      <p className="text-sm text-muted-foreground">No consultations yet.</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Start by creating a consultation and attaching a transcript.
      </p>
      <Button asChild size="lg" className="mt-6">
        <Link href="/consultations/new">New Consultation</Link>
      </Button>
    </div>
  );
}

export default function DashboardPage() {
  const consultationsQuery = useConsultations();
  const statsQuery = useDashboardStats();

  const recentConsultations = (consultationsQuery.data ?? []).slice(0, 10);
  const isConsultationsLoading = consultationsQuery.isLoading;
  const hasNoConsultations = !isConsultationsLoading && recentConsultations.length === 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/consultations/new">+ New Consultation</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/people">Manage People</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/reports">Reports</Link>
        </Button>
      </div>

      {/* Metrics */}
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          title="Consultations"
          value={statsQuery.data?.totalConsultations ?? 0}
          description="Total recorded"
          isLoading={statsQuery.isLoading}
          isError={statsQuery.isError}
        />
        <MetricCard
          title="People"
          value={statsQuery.data?.totalPeople ?? 0}
          description="Linked across consultations"
          isLoading={statsQuery.isLoading}
          isError={statsQuery.isError}
        />
        <MetricCard
          title="Evidence Emails Sent"
          value={statsQuery.data?.emailsSent ?? 0}
          description="Emails sent to date"
          isLoading={statsQuery.isLoading}
          isError={statsQuery.isError}
        />
      </div>

      {/* Recent Consultations */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight">Recent consultations</h2>
          <Button asChild variant="ghost" size="sm" className="text-xs">
            <Link href="/consultations">View all →</Link>
          </Button>
        </div>

        {isConsultationsLoading ? (
          <RecentConsultationsSkeleton />
        ) : hasNoConsultations ? (
          <EmptyState />
        ) : (
          <div className="divide-y rounded-lg border">
            {recentConsultations.map((consultation) => (
              <div key={consultation.id} className="px-4">
                <RecentConsultationRow consultation={consultation} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
